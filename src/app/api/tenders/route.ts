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
import {
  getIncumbentIntelligence,
  type IncumbentIntelligence,
} from "@/lib/tenders/incumbent";
import {
  computeWinProbability,
  buildMatchReasons,
  computeBidRecommendation,
} from "@/lib/tenders/win-probability";

function computeMatchScore(
  userTrades: string[],
  userRegions: string[],
  userAmp: boolean,
  tender: {
    category?: string | null;
    region?: string | null;
    title: string;
    requiresAmp?: boolean;
  }
): { score: number; matchedTrades: string[]; matchedRegion: string | null } {
  let score = 50;
  const title = tender.title.toLowerCase();
  const region = (tender.region ?? "").toLowerCase();
  const matchedTrades: string[] = [];
  let matchedRegion: string | null = null;

  for (const trade of userTrades) {
    if (title.includes(trade.toLowerCase())) {
      score += 15;
      matchedTrades.push(trade);
    }
  }
  for (const r of userRegions) {
    if (region.includes(r.toLowerCase())) {
      score += 20;
      matchedRegion = matchedRegion ?? r;
    }
  }
  if (tender.category === "Construction") score += 5;
  if (tender.requiresAmp) {
    score += userAmp ? 15 : -20;
  }

  return { score: Math.min(100, Math.max(0, score)), matchedTrades, matchedRegion };
}

function valueFit(
  estimatedValue: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): "in_range" | "too_large" | "too_small" | "unknown" {
  if (estimatedValue == null) return "unknown";
  if (max && estimatedValue > max * 1.5) return "too_large";
  if (min && estimatedValue < min * 0.5) return "too_small";
  return "in_range";
}

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
  const userCompany = (user?.companyName ?? "").toLowerCase();

  // Memoize incumbent lookups per category/UNSPSC within this request.
  const incumbentCache = new Map<string, Promise<IncumbentIntelligence>>();
  const incumbentFor = (unspsc: string | null, category: string | null, region: string | null) => {
    const key = `${unspsc ?? ""}|${category ?? ""}|${region ?? ""}`;
    let p = incumbentCache.get(key);
    if (!p) {
      p = getIncumbentIntelligence(unspsc, category, region);
      incumbentCache.set(key, p);
    }
    return p;
  };

  const enriched = await Promise.all(
    tenders.map(async (t) => {
      const daysLeft = t.closesAt ? differenceInDays(t.closesAt, new Date()) : null;
      const isThursday = t.closesAt ? getDay(t.closesAt) === 4 : false;
      const urgent = daysLeft !== null && daysLeft <= 7;
      const match = computeMatchScore(
        userTrades,
        userRegions,
        user?.ampAuthorized ?? false,
        t
      );
      const matchScore = match.score;
      const [similarAwards, amendmentCount, incumbent] = await Promise.all([
        limits.maxTenders > 5 ? getSimilarAwards(t.unspsc, t.category, 3) : Promise.resolve([]),
        t.externalId
          ? prisma.seaoAmendment.count({ where: { tenderExternalId: t.externalId } })
          : Promise.resolve(0),
        // Incumbents operate across regions — don't hard-filter award history
        // by the tender's region or matches become artificially sparse.
        incumbentFor(t.unspsc, t.category, null),
      ]);

      const isUserIncumbent =
        userCompany.length > 2 &&
        incumbent.topIncumbents.some((i) => i.name.toLowerCase().includes(userCompany));
      const fit = valueFit(t.estimatedValue, user?.minProjectCost, user?.maxProjectCost);

      const win = computeWinProbability({
        matchScore,
        ampRequired: t.requiresAmp,
        ampAuthorized: user?.ampAuthorized ?? false,
        estimatedValue: t.estimatedValue,
        userMinCost: user?.minProjectCost,
        userMaxCost: user?.maxProjectCost,
        distinctWinners: incumbent.distinctWinners,
        incumbentDominance: incumbent.dominance,
        isUserIncumbent,
      });

      const matchReasons = buildMatchReasons({
        matchedTrades: match.matchedTrades,
        matchedRegion: match.matchedRegion,
        ampRequired: t.requiresAmp,
        ampAuthorized: user?.ampAuthorized ?? false,
        valueFit: fit,
        distinctWinners: incumbent.distinctWinners,
        isUserIncumbent,
        topIncumbentName: incumbent.topIncumbents[0]?.name ?? null,
      });

      const bidRecommendation = computeBidRecommendation(win, {
        matchScore,
        ampRequired: t.requiresAmp,
        ampAuthorized: user?.ampAuthorized ?? false,
      });

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
          plainSummary: t.aiSummary || t.summary || "",
          sourceUrl: t.sourceUrl,
          hasSimilarAwards,
        },
        { ampAuthorized: user?.ampAuthorized }
      );

      return {
        ...t,
        daysLeft,
        isThursday,
        urgent,
        matchScore,
        score: matchScore,
        winProbability: win.winProbability,
        expectedValue: win.expectedValue,
        winConfidence: win.confidence,
        matchReasons,
        bidRecommendation,
        incumbent: {
          distinctWinners: incumbent.distinctWinners,
          dominance: incumbent.dominance,
          topIncumbents: incumbent.topIncumbents,
        },
        signals,
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
