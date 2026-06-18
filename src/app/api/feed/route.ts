import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { differenceInDays, getDay, subDays } from "date-fns";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { getIntelligenceForPermit } from "@/lib/intelligence";
import { computePipelineScore } from "@/lib/pipeline-score";
import { getPlanLimits } from "@/lib/plans";
import { matchesEssentielProfile, parseJsonArray } from "@/lib/usage";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

function tenderMatchScore(
  userTrades: string[],
  userRegions: string[],
  userAmp: boolean,
  tender: { category?: string | null; region?: string | null; title: string; requiresAmp?: boolean }
) {
  let score = 50;
  const title = tender.title.toLowerCase();
  const region = (tender.region ?? "").toLowerCase();
  for (const trade of userTrades) {
    if (title.includes(trade.toLowerCase())) score += 15;
  }
  for (const r of userRegions) {
    if (region.includes(r.toLowerCase())) score += 20;
  }
  if (tender.requiresAmp) score += userAmp ? 15 : -20;
  return Math.min(100, Math.max(0, score));
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:feed:${ip}`, 90, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("feed");

  const user = await getSessionUser();
  const limits = getPlanLimits(user?.plan);
  const tab = req.nextUrl.searchParams.get("tab") ?? "all";
  const since = subDays(new Date(), 90);
  const userTrades = parseJsonArray(user?.trades);
  const userRegions = parseJsonArray(user?.regions);

  const [permitsRaw, tendersRaw] = await Promise.all([
    tab === "tenders"
      ? []
      : prisma.permit.findMany({
          where: { issueDate: { gte: since } },
          orderBy: { issueDate: "desc" },
          take: limits.maxPermits * 2,
        }),
    tab === "permits"
      ? []
      : prisma.tender.findMany({
          where: {
            closesAt: { gte: new Date() },
            OR: [{ status: null }, { status: { not: "closed" } }],
          },
          orderBy: { closesAt: "asc" },
          take: limits.maxTenders * 2,
        }),
  ]);

  const permits = await Promise.all(
    permitsRaw.map(async (p) => {
      const fit = computeVerifiedRbqFit(
        user?.rbqLicenseClass,
        user?.rbqLicenseNumber,
        user?.rbqVerified ?? false,
        p.permitType,
        p.workType
      );
      const intelligence =
        limits.intelligenceFull ? await getIntelligenceForPermit(p) : undefined;
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
        kind: "permit" as const,
        id: p.id,
        score: pipeline.score,
        permit: {
          ...p,
          rbqFit: fit,
          pipelineScore: pipeline.score,
        },
      };
    })
  );

  const tenders = tendersRaw.map((t) => {
    const daysLeft = t.closesAt ? differenceInDays(t.closesAt, new Date()) : null;
    return {
      kind: "tender" as const,
      id: t.id,
      score: tenderMatchScore(userTrades, userRegions, user?.ampAuthorized ?? false, t),
      tender: {
        ...t,
        daysLeft,
        isThursday: t.closesAt ? getDay(t.closesAt) === 4 : false,
        urgent: daysLeft !== null && daysLeft <= 7,
        matchScore: tenderMatchScore(userTrades, userRegions, user?.ampAuthorized ?? false, t),
        plainSummary: t.aiSummary || t.summary,
      },
    };
  });

  let items = [...permits, ...tenders];
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

  items.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    items: items.slice(0, limits.maxPermits + limits.maxTenders),
    profile: {
      trades: userTrades,
      regions: userRegions,
      ampAuthorized: user?.ampAuthorized ?? false,
    },
  });
}
