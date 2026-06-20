import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { differenceInDays, getDay } from "date-fns";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { getPlanLimits } from "@/lib/plans";
import { getSimilarAwards } from "@/lib/datasets/fetchers/awards";
import {
  canViewTenderMatch,
  incrementUsage,
  matchesEssentielProfile,
  parseJsonArray,
} from "@/lib/usage";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { computeLeadSignals } from "@/lib/lead-signals";
import { computeTenderScore } from "@/lib/tender-score";
import { buildTenderOpportunityDossier } from "@/lib/opportunities/dossier";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:tenders:${ip}`, 90, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("tenders");

  const user = await getSessionUser();
  const limits = getPlanLimits(user?.plan);
  const { searchParams } = req.nextUrl;
  const category = searchParams.get("category");
  const region = searchParams.get("region");
  const q = searchParams.get("q")?.trim();
  const ampOnly = searchParams.get("ampOnly") === "true";

  const standingOnly = searchParams.get("standing") === "true";

  const statusOpen = standingOnly
    ? { status: "standing" }
    : { OR: [{ status: null }, { status: { not: "closed" } }] };

  const tenders = await prisma.tender.findMany({
    where: {
      AND: [
        statusOpen,
        ...(standingOnly ? [] : [{ closesAt: { gte: new Date() } }]),
        ...(category ? [{ category }] : []),
        ...(region ? [{ region: { contains: region } }] : []),
        ...(ampOnly ? [{ requiresAmp: true }] : []),
        ...(q
          ? [
              {
                OR: [
                  { title: { contains: q } },
                  { organization: { contains: q } },
                  { description: { contains: q } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: { closesAt: "asc" },
    take: limits.maxTenders * 2,
  });

  const userTrades = parseJsonArray(user?.trades);
  const userRegions = parseJsonArray(user?.regions);

  const enriched = await Promise.all(
    tenders.map(async (t) => {
      const daysLeft = t.closesAt ? differenceInDays(t.closesAt, new Date()) : null;
      const isThursday = t.closesAt ? getDay(t.closesAt) === 4 : false;
      const urgent = daysLeft !== null && daysLeft <= 7;
      const ranking = computeTenderScore(t, {
        trades: userTrades,
        regions: userRegions,
        ampAuthorized: user?.ampAuthorized ?? false,
        minProjectCost: user?.minProjectCost,
        maxProjectCost: user?.maxProjectCost,
      });
      const matchScore = ranking.score;
      const [similarAwards, amendmentCount] = await Promise.all([
        limits.maxTenders > 5 ? getSimilarAwards(t.unspsc, t.category, 3) : Promise.resolve([]),
        t.externalId
          ? prisma.seaoAmendment.count({ where: { tenderExternalId: t.externalId } })
          : Promise.resolve(0),
      ]);

      const hasSimilarAwards = similarAwards.length > 0;
      const signals = computeLeadSignals(
        {
          kind: "tender",
          id: t.id,
          score: matchScore,
          title: t.title,
          organization: t.organization,
          closesAt: t.closesAt,
          daysLeft,
          isThursday,
          urgent,
          requiresAmp: t.requiresAmp,
          matchScore,
          ranking,
          plainSummary: t.aiSummary || t.summary || "",
          sourceUrl: t.sourceUrl,
          hasSimilarAwards,
        },
        { ampAuthorized: user?.ampAuthorized }
      );
      const opportunityDossier = buildTenderOpportunityDossier({
        tender: { ...t, amendmentCount },
        score: matchScore,
        signals,
        ranking,
        hasSimilarAwards,
      });

      return {
        ...t,
        daysLeft,
        isThursday,
        urgent,
        matchScore,
        score: matchScore,
        signals,
        ranking,
        opportunityDossier,
        similarAwards,
        amendmentCount,
        plainSummary:
          t.aiSummary ||
          t.summary ||
          `Appel d'offres ${t.category ?? "public"} — soumission avant la date de clôture indiquée.`,
      };
    })
  );

  let filtered = enriched.filter((t) =>
    matchesEssentielProfile(user?.plan, userTrades, userRegions, {
      title: t.title,
      region: t.region ?? undefined,
    })
  );

  filtered.sort((a, b) => b.matchScore - a.matchScore);

  if (user && user.plan === "ESSENTIEL") {
    const allowed = await canViewTenderMatch(user.plan, user.id);
    if (!allowed) {
      filtered = filtered.slice(0, 3);
    } else {
      const slice = filtered.slice(0, limits.maxTenders);
      if (slice.length > 0) {
        await incrementUsage(user.id, "seao_matches", slice.length);
      }
      filtered = slice;
    }
  } else {
    filtered = filtered.slice(0, limits.maxTenders);
  }

  return NextResponse.json({
    tenders: filtered,
    categories: [
      ...new Set(
        tenders.map((t) => t.category).filter((c): c is string => Boolean(c))
      ),
    ].slice(0, 20),
    plan: user?.plan ?? "FREE",
    complianceEntitled: getPlanLimits(user?.plan).complianceVault,
    limits: { maxTenders: limits.maxTenders },
  });
}
