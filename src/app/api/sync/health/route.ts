import { NextRequest, NextResponse } from "next/server";
import { getDatasetStaleness } from "@/lib/sync/scheduler";
import { DATASETS, TIER_DATASETS, COVERAGE_CITIES, getDatasetCount, getActiveDatasetIds } from "@/lib/datasets/registry";
import { isSyncAutomationEnabled } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getLiveMaxAgeMinutes, getSyncBatchSize } from "@/lib/sync/live-watch";
import { getLatestQualityByDataset } from "@/lib/sync/quality";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { enforceRateLimit } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:sync-health", 30, 60_000);
  if (limited) return limited;

  const authorized = isSyncAuthorized(req);
  const staleness = await getDatasetStaleness();
  const states = await prisma.syncState.findMany();
  const qualityMap = authorized ? await getLatestQualityByDataset() : new Map();

  const datasets = staleness.map((s) => {
    const state = states.find((st) => st.datasetId === s.datasetId);
    const quality = qualityMap.get(s.datasetId);
    const hasAnomaly = quality?.status === "anomaly";
    const health =
      hasAnomaly
        ? "anomaly"
        : s.status === "running"
          ? "syncing"
          : s.staleRatio >= 2
            ? "critical"
            : s.stale
              ? "stale"
              : "healthy";

    const base = {
      id: s.datasetId,
      label: s.label,
      tier: DATASETS[s.datasetId].tier,
      health,
      staleRatio: Number.isFinite(s.staleRatio) ? s.staleRatio : null,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      refreshIntervalMinutes: s.refreshIntervalMinutes,
    };

    if (!authorized) return base;

    return {
      ...base,
      sourceModifiedAt: state?.sourceModifiedAt?.toISOString() ?? null,
      syncOffset: state?.syncOffset ?? 0,
      lastError: state?.lastError ?? null,
      sourceUrl: DATASETS[s.datasetId].sourceUrl,
      lastQualityCheck: quality
        ? {
            status: quality.status,
            message: quality.message,
            checkedAt: quality.checkedAt.toISOString(),
          }
        : null,
      anomaly: hasAnomaly,
    };
  });

  const critical = datasets.filter((d) => d.health === "critical").length;
  const stale = datasets.filter((d) => d.health === "stale").length;
  const healthy = datasets.filter((d) => d.health === "healthy").length;
  const anomalies = datasets.filter((d) => d.health === "anomaly").length;

  return NextResponse.json({
    ok: critical === 0 && anomalies === 0,
    automation: {
      enabled: isSyncAutomationEnabled(),
      schedule: authorized
        ? {
            live: "*/5 min",
            scheduler: "*/15 min",
            daily: "*/4 h",
            weekly: "Sunday 08:00 UTC",
            bootstrap: "*/6 h",
            alerts: "daily 12:00 UTC",
          }
        : undefined,
    },
    live: authorized
      ? {
          watchIntervalMinutes: getLiveMaxAgeMinutes(),
          batchSize: getSyncBatchSize(),
          fastTier: TIER_DATASETS.fast,
          crons: ["*/5 live", "*/15 scheduler", "*/4h daily", "weekly Sunday"],
        }
      : undefined,
    summary: {
      healthy,
      stale,
      critical,
      anomalies,
      total: datasets.length,
      datasetCount: getDatasetCount(),
      registeredDatasets: getActiveDatasetIds().length,
      coverageCities: [...COVERAGE_CITIES],
      freshnessSla: {
        fastMinutes: getLiveMaxAgeMinutes(),
        dailyHours: 4,
        weeklyDays: 7,
      },
    },
    datasets: authorized ? datasets : datasets.map(({ id, label, health, lastSuccessAt }) => ({
      id,
      label,
      health,
      lastSuccessAt,
    })),
    checkedAt: new Date().toISOString(),
  });
}
