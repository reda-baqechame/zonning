import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { subDays } from "date-fns";
import { getDatasetCount, COVERAGE_CITIES } from "@/lib/datasets/registry";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:stats:${ip}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("stats");
  const weekAgo = subDays(new Date(), 7);
  const [permitsWeek, tendersOpen, companies, rbqLicenses, heritage, contracts, permitState] =
    await Promise.all([
      prisma.permit.count({ where: { issueDate: { gte: weekAgo } } }),
      prisma.tender.count({
        where: {
          closesAt: { gte: new Date() },
          OR: [{ status: null }, { status: { not: "closed" } }],
        },
      }),
      prisma.company.count(),
      prisma.rbqLicense.count({ where: { status: "active" } }),
      prisma.heritageSite.count(),
      prisma.municipalContract.count(),
      prisma.syncState.findUnique({ where: { datasetId: "permits" } }),
    ]);

  return NextResponse.json({
    permitsWeek,
    tendersOpen,
    companies,
    rbqLicenses,
    heritage,
    contracts,
    permitsLastSuccessAt: permitState?.lastSuccessAt?.toISOString() ?? null,
    datasetCount: getDatasetCount(),
    coverageCities: COVERAGE_CITIES.length,
    cities: [...COVERAGE_CITIES],
    updatedAt: new Date().toISOString(),
  });
}
