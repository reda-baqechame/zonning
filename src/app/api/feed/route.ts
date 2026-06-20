import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureFreshForKey, ensureQuebecRealtimeFresh } from "@/lib/sync/auto";
import { differenceInDays, getDay, subDays, addDays } from "date-fns";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { computePipelineScore } from "@/lib/pipeline-score";
import { getPlanLimits } from "@/lib/plans";
import { matchesEssentielProfile, parseJsonArray } from "@/lib/usage";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import {
  batchCompetitionCounts,
  createIntelligenceCache,
  getCompetitionFromMap,
} from "@/lib/scoring/batch";
import { computeLeadSignals } from "@/lib/lead-signals";
import { HIGH_VALUE_THRESHOLD } from "@/lib/format-cad";
import { getSimilarAwards } from "@/lib/datasets/fetchers/awards";
import { computeTenderScore } from "@/lib/tender-score";
import { assessPermitQuality } from "@/lib/permits/quality";
import {
  buildPermitOpportunityDossier,
  buildTenderOpportunityDossier,
} from "@/lib/opportunities/dossier";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:feed:${ip}`, 90, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("feed");
  ensureQuebecRealtimeFresh();

  const user = await getSessionUser();
  const limits = getPlanLimits(user?.plan);
  const tab = req.nextUrl.searchParams.get("tab") ?? "all";
  const isWatchlist = tab === "watchlist";
  const since = subDays(new Date(), 90);
  const userTrades = parseJsonArray(user?.trades);
  const userRegions = parseJsonArray(user?.regions);
  const userCtx = {
    minProjectCost: user?.minProjectCost,
    maxProjectCost: user?.maxProjectCost,
    rbqVerified: user?.rbqVerified,
    ampAuthorized: user?.ampAuthorized,
  };

  const savedRows = user
    ? await prisma.savedLead.findMany({
        where: { userId: user.id },
        select: { kind: true, itemId: true, notes: true, createdAt: true },
      })
    : [];
  const savedPermitIds = savedRows
    .filter((row) => row.kind === "permit")
    .map((row) => row.itemId);
  const savedTenderIds = savedRows
    .filter((row) => row.kind === "tender")
    .map((row) => row.itemId);

  const [permitsRaw, tendersRaw] = await Promise.all([
    tab === "tenders"
      ? []
      : prisma.permit.findMany({
          where: isWatchlist
            ? { id: { in: savedPermitIds } }
            : { issueDate: { gte: since } },
          orderBy: { issueDate: "desc" },
          ...(isWatchlist ? {} : { take: limits.maxPermits * 2 }),
        }),
    tab === "permits"
      ? []
      : prisma.tender.findMany({
          where: isWatchlist
            ? { id: { in: savedTenderIds } }
            : {
                closesAt: { gte: new Date() },
                OR: [{ status: null }, { status: { not: "closed" } }],
              },
          orderBy: { closesAt: "asc" },
          ...(isWatchlist ? {} : { take: limits.maxTenders * 2 }),
        }),
  ]);

  const savedIds = new Set(savedRows.map((s) => `${s.kind}:${s.itemId}`));
  const savedByKey = new Map(
    savedRows.map((row) => [
      `${row.kind}:${row.itemId}`,
      { notes: row.notes, createdAt: row.createdAt },
    ]),
  );
  const competitionMap = await batchCompetitionCounts(permitsRaw);
  const getIntel = limits.intelligenceFull ? createIntelligenceCache() : null;

  const permitsEnriched = await Promise.all(
    permitsRaw.map(async (p) => {
      const dataQuality = assessPermitQuality(p);
      const fit = computeVerifiedRbqFit(
        user?.rbqLicenseClass,
        user?.rbqLicenseNumber,
        user?.rbqVerified ?? false,
        p.permitType,
        p.workType,
      );
      const intelligence = getIntel ? await getIntel(p) : undefined;
      const competitionCount = getCompetitionFromMap(
        competitionMap,
        p.permitType,
        p.borough,
      );
      const pipeline = await computePipelineScore(
        p,
        {
          rbqLicenseClass: user?.rbqLicenseClass,
          rbqLicenseNumber: user?.rbqLicenseNumber,
          rbqVerified: user?.rbqVerified,
          minProjectCost: user?.minProjectCost,
          maxProjectCost: user?.maxProjectCost,
        },
        intelligence,
        { competitionCount, dataQualityScore: dataQuality.score },
      );
      const signals = computeLeadSignals(
        {
          kind: "permit",
          id: p.id,
          score: pipeline.score,
          permitType: p.permitType,
          address: p.address,
          borough: p.borough,
          city: p.city,
          estimatedCost: p.estimatedCost,
          issueDate: p.issueDate,
          rbqFit: fit,
          pipeline,
          intelligence,
        },
        userCtx,
      );
      const opportunityDossier = buildPermitOpportunityDossier({
        permit: p,
        score: pipeline.score,
        signals,
        pipeline,
        dataQuality,
        intelligence,
      });
      return {
        kind: "permit" as const,
        id: p.id,
        score: pipeline.score,
        signals,
        opportunityDossier,
        saved: savedIds.has(`permit:${p.id}`),
        savedNote: savedByKey.get(`permit:${p.id}`)?.notes ?? null,
        permit: {
          ...p,
          rbqFit: fit,
          pipelineScore: pipeline.score,
          pipeline,
          intelligence,
          dataQuality,
          opportunityDossier,
        },
      };
    }),
  );
  const permits = permitsEnriched.filter(
    (item) => isWatchlist || item.permit.dataQuality.usable,
  );

  const tenders = await Promise.all(
    tendersRaw.map(async (t) => {
      const daysLeft = t.closesAt
        ? differenceInDays(t.closesAt, new Date())
        : null;
      const [similarAwards, amendmentCount] = await Promise.all([
        limits.maxTenders > 5
          ? getSimilarAwards(t.unspsc, t.category, 3)
          : Promise.resolve([]),
        t.externalId
          ? prisma.seaoAmendment.count({
              where: { tenderExternalId: t.externalId },
            })
          : Promise.resolve(0),
      ]);
      const ranking = computeTenderScore(t, {
        trades: userTrades,
        regions: userRegions,
        ampAuthorized: user?.ampAuthorized ?? false,
        minProjectCost: user?.minProjectCost,
        maxProjectCost: user?.maxProjectCost,
      });
      const score = ranking.score;
      const hasSimilarAwards = similarAwards.length > 0;
      const signals = computeLeadSignals(
        {
          kind: "tender",
          id: t.id,
          score,
          title: t.title,
          organization: t.organization,
          closesAt: t.closesAt,
          daysLeft,
          isThursday: t.closesAt ? getDay(t.closesAt) === 4 : false,
          urgent: daysLeft !== null && daysLeft <= 7,
          requiresAmp: t.requiresAmp,
          matchScore: score,
          ranking,
          plainSummary: t.aiSummary || t.summary || undefined,
          sourceUrl: t.sourceUrl,
          hasSimilarAwards,
        },
        userCtx,
      );
      const opportunityDossier = buildTenderOpportunityDossier({
        tender: { ...t, amendmentCount },
        score,
        signals,
        ranking,
        hasSimilarAwards,
      });
      return {
        kind: "tender" as const,
        id: t.id,
        score,
        signals,
        opportunityDossier,
        saved: savedIds.has(`tender:${t.id}`),
        savedNote: savedByKey.get(`tender:${t.id}`)?.notes ?? null,
        tender: {
          ...t,
          daysLeft,
          isThursday: t.closesAt ? getDay(t.closesAt) === 4 : false,
          urgent: daysLeft !== null && daysLeft <= 7,
          matchScore: score,
          ranking,
          plainSummary: t.aiSummary || t.summary || undefined,
          amendmentCount,
          similarAwards: limits.maxTenders > 5 ? similarAwards : undefined,
          opportunityDossier,
        },
      };
    }),
  );

  let items = [...permits, ...tenders];
  if (!isWatchlist) {
    items = items.filter((item) => {
      if (item.kind === "permit") {
        return matchesEssentielProfile(user?.plan, userTrades, userRegions, {
          trade: item.permit.permitType,
          region: item.permit.borough ?? item.permit.city ?? undefined,
          borough: item.permit.borough ?? undefined,
        });
      }
      return matchesEssentielProfile(user?.plan, userTrades, userRegions, {
        title: item.tender.title,
        region: item.tender.region ?? undefined,
      });
    });
  }

  items.sort((a, b) => {
    if (!isWatchlist) {
      const scoreDifference = b.score - a.score;
      if (scoreDifference) return scoreDifference;
      const aConfidence =
        a.kind === "permit"
          ? a.permit.pipeline.confidence
          : a.tender.ranking.confidence;
      const bConfidence =
        b.kind === "permit"
          ? b.permit.pipeline.confidence
          : b.tender.ranking.confidence;
      const confidenceDifference = bConfidence - aConfidence;
      if (confidenceDifference) return confidenceDifference;
      const aDate =
        a.kind === "permit"
          ? a.permit.issueDate?.getTime()
          : a.tender.closesAt?.getTime();
      const bDate =
        b.kind === "permit"
          ? b.permit.issueDate?.getTime()
          : b.tender.closesAt?.getTime();
      const dateDifference = (bDate ?? 0) - (aDate ?? 0);
      if (dateDifference) return dateDifference;
      return a.id.localeCompare(b.id);
    }
    const aSavedAt =
      savedByKey.get(`${a.kind}:${a.id}`)?.createdAt.getTime() ?? 0;
    const bSavedAt =
      savedByKey.get(`${b.kind}:${b.id}`)?.createdAt.getTime() ?? 0;
    return bSavedAt - aSavedAt;
  });

  const maxItems = isWatchlist
    ? items.length
    : limits.maxPermits + limits.maxTenders;
  const sliced = items.slice(0, maxItems);
  const hidden = items.slice(maxItems);

  const [poolPermits, poolHighValue, poolUrgentTenders] = await Promise.all([
    prisma.permit.count({ where: { issueDate: { gte: since } } }),
    prisma.permit.count({
      where: {
        issueDate: { gte: since },
        estimatedCost: { gte: HIGH_VALUE_THRESHOLD },
      },
    }),
    prisma.tender.count({
      where: {
        closesAt: { gte: new Date(), lte: addDays(new Date(), 7) },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
    }),
  ]);

  const hiddenHighValue = hidden.filter(
    (i) =>
      i.kind === "permit" &&
      (i.permit.estimatedCost ?? 0) >= HIGH_VALUE_THRESHOLD,
  ).length;
  const hiddenUrgent = hidden.filter(
    (i) =>
      i.kind === "tender" &&
      i.tender.daysLeft != null &&
      i.tender.daysLeft <= 7,
  ).length;
  const estimatedValueHidden = hidden.reduce((sum, i) => {
    if (i.kind === "permit" && i.permit.estimatedCost)
      return sum + i.permit.estimatedCost;
    return sum;
  }, 0);

  const shownPermits = sliced.filter((i) => i.kind === "permit").length;
  const shownTenders = sliced.filter((i) => i.kind === "tender").length;
  const shownHighValue = sliced.filter(
    (i) =>
      i.kind === "permit" &&
      (i.permit.estimatedCost ?? 0) >= HIGH_VALUE_THRESHOLD,
  ).length;

  return NextResponse.json({
    items: sliced,
    meta: {
      plan: user?.plan ?? "FREE",
      poolPermits,
      poolHighValue,
      poolUrgentTenders,
      shownPermits,
      shownTenders,
      hiddenHighValue: Math.max(
        hiddenHighValue,
        poolHighValue - shownHighValue,
      ),
      hiddenUrgent: Math.max(hiddenUrgent, poolUrgentTenders - shownTenders),
      estimatedValueHidden,
    },
    profile: {
      trades: userTrades,
      regions: userRegions,
      ampAuthorized: user?.ampAuthorized ?? false,
    },
    plan: user?.plan ?? "FREE",
    complianceEntitled: user ? getPlanLimits(user.plan).complianceVault : false,
  });
}
