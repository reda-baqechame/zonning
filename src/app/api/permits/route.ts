import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { computePipelineScore } from "@/lib/pipeline-score";
import { getPlanLimits } from "@/lib/plans";
import { matchesEssentielProfile, parseJsonArray } from "@/lib/usage";
import { haversineKm } from "@/lib/datasets/geo";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { subDays } from "date-fns";
import {
  batchCompetitionCounts,
  createIntelligenceCache,
  getCompetitionFromMap,
} from "@/lib/scoring/batch";
import { computeLeadSignals } from "@/lib/lead-signals";
import { assessPermitQuality } from "@/lib/permits/quality";
import { buildPermitOpportunityDossier } from "@/lib/opportunities/dossier";

function isDatabaseConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("Connection terminated due to connection timeout") ||
    message.includes("Connection terminated unexpectedly")
  );
}

async function loadGtcSites() {
  return prisma.contaminatedSite.findMany({
    where: {
      sourceLayer: "gtc",
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { latitude: true, longitude: true },
    take: 8000,
  });
}

function isNearGtc(
  lat: number | null | undefined,
  lng: number | null | undefined,
  gtcSites: { latitude: number | null; longitude: number | null }[],
) {
  if (lat == null || lng == null) return false;
  return gtcSites.some(
    (s) =>
      s.latitude != null &&
      s.longitude != null &&
      haversineKm(lat, lng, s.latitude, s.longitude) < 0.5,
  );
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:permits:${ip}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
  const user = await getSessionUser();
  const limits = getPlanLimits(user?.plan);
  const publicPreview = !user;
  const { searchParams } = req.nextUrl;
  const borough = searchParams.get("borough");
  const city = searchParams.get("city");
  const minCost = searchParams.get("minCost");
  const permitType = searchParams.get("permitType");
  const eligibleOnly = searchParams.get("eligibleOnly") === "true";
  const noGtc = searchParams.get("noGtc") === "true";
  const withIntel = searchParams.get("intelligence") !== "false";
  const sort = searchParams.get("sort") ?? "pipeline";
  const days = parseInt(searchParams.get("days") ?? "90", 10);
  const requestedLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const maxPermits = publicPreview
    ? Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 20, 30)
    : limits.maxPermits;
  const since = subDays(new Date(), Number.isFinite(days) ? days : 90);

  const userTrades = parseJsonArray(user?.trades);
  const userRegions = parseJsonArray(user?.regions);
  const gtcSites = noGtc ? await loadGtcSites() : [];

  const permits = await prisma.permit.findMany({
    where: {
      ...(borough ? { borough } : {}),
      ...(city ? { city } : {}),
      ...(minCost ? { estimatedCost: { gte: parseFloat(minCost) } } : {}),
      ...(permitType ? { permitType: { contains: permitType } } : {}),
      issueDate: { gte: since },
    },
    orderBy: { issueDate: "desc" },
    take: maxPermits * 2,
  });

  const enriched = await (async () => {
    const competitionMap = await batchCompetitionCounts(permits);
    const getIntel =
      withIntel && !publicPreview && limits.intelligenceFull ? createIntelligenceCache() : null;

    return Promise.all(
      permits.map(async (p) => {
        const dataQuality = assessPermitQuality(p);
        const required = p.requiredRbqClasses
          ? (JSON.parse(p.requiredRbqClasses) as string[])
          : [];
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
          {
            minProjectCost: user?.minProjectCost,
            rbqVerified: user?.rbqVerified,
          },
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
          ...p,
          requiredRbqClasses: required,
          rbqFit: fit,
          intelligence,
          pipelineScore: pipeline.score,
          pipeline,
          signals,
          dataQuality,
          opportunityDossier,
        };
      }),
    );
  })();

  let filtered = enriched.filter(
    (p) =>
      p.dataQuality.usable &&
      matchesEssentielProfile(user?.plan, userTrades, userRegions, {
        trade: p.permitType,
        region: p.borough ?? p.city ?? undefined,
        borough: p.borough ?? undefined,
        title: p.workType ?? undefined,
      }),
  );

  if (eligibleOnly) {
    filtered = filtered.filter((p) => p.rbqFit.eligible);
  }

  if (noGtc) {
    filtered = filtered.filter(
      (p) => !isNearGtc(p.latitude, p.longitude, gtcSites),
    );
  }

  if (sort === "pipeline") {
    filtered.sort((a, b) => {
      const scoreDifference = b.pipelineScore - a.pipelineScore;
      if (scoreDifference) return scoreDifference;
      const confidenceDifference =
        b.pipeline.confidence - a.pipeline.confidence;
      if (confidenceDifference) return confidenceDifference;
      const dateDifference =
        (b.issueDate?.getTime() ?? 0) - (a.issueDate?.getTime() ?? 0);
      if (dateDifference) return dateDifference;
      return a.id.localeCompare(b.id);
    });
  }

  const mappable = filtered.filter((p) => p.latitude && p.longitude).length;

  // Honest zero-state diagnostics: explain *why* results may be empty instead
  // of silently showing "0 résultats". Counts are scoped to the active
  // city/borough so the user sees the funnel from raw indexed → on the map.
  const scope = {
    ...(borough ? { borough } : {}),
    ...(city ? { city } : {}),
  };
  const [rawIndexed, afterDateFilter, permitState] = await Promise.all([
    prisma.permit.count({ where: scope }),
    prisma.permit.count({ where: { ...scope, issueDate: { gte: since } } }),
    prisma.syncState.findUnique({ where: { datasetId: "permits" } }),
  ]);

  let zeroReason: string | null = null;
  if (filtered.length === 0) {
    if (rawIndexed === 0) zeroReason = "no_permits_indexed";
    else if (afterDateFilter === 0) zeroReason = "none_in_date_window";
    else zeroReason = "none_pass_filters";
  }

  return NextResponse.json({
    permits: filtered.slice(0, maxPermits),
    plan: user?.plan ?? "FREE",
    complianceEntitled: publicPreview ? false : getPlanLimits(user?.plan).complianceVault,
    limits: { maxPermits },
    mappable,
    total: filtered.length,
    diagnostics: {
      rawIndexed,
      afterDateFilter,
      afterFilters: filtered.length,
      mappable,
      days: Number.isFinite(days) ? days : 90,
      lastSyncAt: permitState?.lastSuccessAt?.toISOString() ?? null,
      zeroReason,
    },
  });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn("[api/permits] database connection unavailable", {
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({
        permits: [],
        plan: "FREE",
        complianceEntitled: false,
        limits: { maxPermits: 0 },
        mappable: 0,
        total: 0,
        dataUnavailable: true,
        diagnostics: {
          rawIndexed: 0,
          afterDateFilter: 0,
          afterFilters: 0,
          mappable: 0,
          days: 90,
          lastSyncAt: null,
          zeroReason: "database_unavailable",
        },
      });
    }
    throw error;
  }
}
