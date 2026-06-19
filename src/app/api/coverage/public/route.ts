import { NextRequest, NextResponse } from "next/server";
import { fetchMarketPulseStats } from "@/lib/market-pulse";
import { citySourceLabel } from "@/lib/quebec-coverage";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { ensureQuebecRealtimeFresh } from "@/lib/sync/auto";
import { buildSyncHealthSummary } from "@/lib/sync/health-summary";
import { getDataModeStatus } from "@/lib/sync/demo-fallback";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:coverage:${ip}`, 90, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureQuebecRealtimeFresh();
  const [stats, health, dataMode] = await Promise.all([
    fetchMarketPulseStats(),
    buildSyncHealthSummary({ authorized: false }),
    getDataModeStatus().catch(() => null),
  ]);

  const syncSummary = {
    healthy: health.summary.healthy,
    stale: health.summary.stale,
    critical: health.summary.critical,
    anomalies: health.summary.anomalies,
    ok: health.ok,
  };

  const cities = stats.cityBreakdown.map((row) => ({
    ...row,
    mapPercent:
      row.totalPermits > 0
        ? Math.round((row.mappablePermits / row.totalPermits) * 100)
        : 0,
    sourceLabel: citySourceLabel(row.city as (typeof COVERAGE_CITIES)[number]),
  }));

  return NextResponse.json({
    ...stats,
    cities,
    syncSummary,
    dataMode: dataMode?.mode,
    demoFallbackActive: dataMode?.demoFallbackActive ?? false,
    updatedAt: stats.updatedAt,
  });
}
