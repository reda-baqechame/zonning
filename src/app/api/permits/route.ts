import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { getIntelligenceForPermit } from "@/lib/intelligence";
import { computePipelineScore } from "@/lib/pipeline-score";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { getPlanLimits } from "@/lib/plans";
import { matchesEssentielProfile, parseJsonArray } from "@/lib/usage";
import { haversineKm } from "@/lib/datasets/geo";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { subDays } from "date-fns";

async function loadGtcSites() {
  return prisma.contaminatedSite.findMany({
    where: { sourceLayer: "gtc", latitude: { not: null }, longitude: { not: null } },
    select: { latitude: true, longitude: true },
    take: 8000,
  });
}

function isNearGtc(
  lat: number | null | undefined,
  lng: number | null | undefined,
  gtcSites: { latitude: number | null; longitude: number | null }[]
) {
  if (lat == null || lng == null) return false;
  return gtcSites.some(
    (s) =>
      s.latitude != null &&
      s.longitude != null &&
      haversineKm(lat, lng, s.latitude, s.longitude) < 0.5
  );
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:permits:${ip}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("permits");

  const user = await getSessionUser();
  const limits = getPlanLimits(user?.plan);
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
    take: limits.maxPermits * 2,
  });

  const enriched = await Promise.all(
    permits.map(async (p) => {
      const required = p.requiredRbqClasses
        ? (JSON.parse(p.requiredRbqClasses) as string[])
        : [];
      const fit = computeVerifiedRbqFit(
        user?.rbqLicenseClass,
        user?.rbqLicenseNumber,
        user?.rbqVerified ?? false,
        p.permitType,
        p.workType
      );
      const intelligence =
        withIntel && limits.intelligenceFull
          ? await getIntelligenceForPermit(p)
          : undefined;
      const pipeline = await computePipelineScore(
        p,
        {
          rbqLicenseClass: user?.rbqLicenseClass,
          rbqLicenseNumber: user?.rbqLicenseNumber,
          rbqVerified: user?.rbqVerified,
          minProjectCost: user?.minProjectCost,
          maxProjectCost: user?.maxProjectCost,
        },
        intelligence
      );
      return {
        ...p,
        requiredRbqClasses: required,
        rbqFit: fit,
        intelligence,
        pipelineScore: pipeline.score,
        pipeline,
      };
    })
  );

  let filtered = enriched.filter((p) =>
    matchesEssentielProfile(user?.plan, userTrades, userRegions, {
      trade: p.permitType,
      region: p.borough ?? p.city ?? undefined,
      borough: p.borough ?? undefined,
      title: p.workType ?? undefined,
    })
  );

  if (eligibleOnly) {
    filtered = filtered.filter((p) => p.rbqFit.eligible);
  }

  if (noGtc) {
    filtered = filtered.filter((p) => !isNearGtc(p.latitude, p.longitude, gtcSites));
  }

  if (sort === "pipeline") {
    filtered.sort((a, b) => b.pipelineScore - a.pipelineScore);
  }

  return NextResponse.json({
    permits: filtered.slice(0, limits.maxPermits),
    plan: user?.plan ?? "FREE",
    limits: { maxPermits: limits.maxPermits },
  });
}
