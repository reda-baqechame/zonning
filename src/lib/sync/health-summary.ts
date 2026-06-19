import { prisma } from "@/lib/prisma";
import { DATASETS, COVERAGE_CITIES, getDatasetCount, getActiveDatasetIds } from "@/lib/datasets/registry";
import { getDatasetStaleness } from "@/lib/sync/scheduler";
import { getLatestQualityByDataset } from "@/lib/sync/quality";
import { isSyncAutomationEnabled } from "@/lib/env";
import { getLiveMaxAgeMinutes, getSyncBatchSize } from "@/lib/sync/live-watch";
import { TIER_DATASETS } from "@/lib/datasets/registry";

export type SyncHealthDataset = {
  id: string;
  label: string;
  tier: string;
  health: "healthy" | "stale" | "critical" | "syncing" | "anomaly";
  staleRatio: number | null;
  lastSuccessAt: string | null;
  refreshIntervalMinutes: number;
  sourceModifiedAt?: string | null;
  syncOffset?: number;
  lastError?: string | null;
  sourceUrl?: string;
  lastQualityCheck?: {
    status: string;
    message: string | null;
    checkedAt: string;
  } | null;
  anomaly?: boolean;
};

export type SyncHealthSummary = {
  ok: boolean;
  summary: {
    healthy: number;
    stale: number;
    critical: number;
    anomalies: number;
    total: number;
    datasetCount: number;
    registeredDatasets: number;
    coverageCities: string[];
  };
  datasets: SyncHealthDataset[];
  checkedAt: string;
};

function datasetHealth(
  status: string,
  staleRatio: number,
  hasAnomaly: boolean
): SyncHealthDataset["health"] {
  if (hasAnomaly) return "anomaly";
  if (status === "running") return "syncing";
  if (staleRatio >= 2) return "critical";
  if (staleRatio >= 1) return "stale";
  return "healthy";
}

/** Shared sync health payload for API routes (no HTTP self-fetch). */
export async function buildSyncHealthSummary(options?: {
  authorized?: boolean;
}): Promise<SyncHealthSummary> {
  const authorized = options?.authorized ?? false;
  const staleness = await getDatasetStaleness();
  const states = await prisma.syncState.findMany();
  const qualityMap = authorized ? await getLatestQualityByDataset() : new Map();

  const datasets: SyncHealthDataset[] = staleness.map((s) => {
    const state = states.find((st) => st.datasetId === s.datasetId);
    const quality = qualityMap.get(s.datasetId);
    const hasAnomaly = quality?.status === "anomaly";
    const health = datasetHealth(s.status, s.staleRatio, hasAnomaly);

    const base: SyncHealthDataset = {
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

  return {
    ok: critical === 0 && anomalies === 0,
    summary: {
      healthy,
      stale,
      critical,
      anomalies,
      total: datasets.length,
      datasetCount: getDatasetCount(),
      registeredDatasets: getActiveDatasetIds().length,
      coverageCities: [...COVERAGE_CITIES],
    },
    datasets: authorized
      ? datasets
      : datasets.map(({ id, label, health, lastSuccessAt }) => ({
          id,
          label,
          tier: DATASETS[id as keyof typeof DATASETS].tier,
          health,
          staleRatio: null,
          lastSuccessAt,
          refreshIntervalMinutes: DATASETS[id as keyof typeof DATASETS].refreshIntervalMinutes,
        })),
    checkedAt: new Date().toISOString(),
  };
}

export function syncAutomationMeta(authorized: boolean) {
  return {
    enabled: isSyncAutomationEnabled(),
    schedule: authorized
      ? {
          rgm: "*/3 min",
          live: "*/5 min",
          scheduler: "*/15 min",
          daily: "*/4 h",
          weekly: "Sunday 08:00 UTC",
          bootstrap: "*/6 h",
          alerts: "daily 12:00 UTC",
          alertsLive: "*/15 min",
        }
      : undefined,
    live: authorized
      ? {
          watchIntervalMinutes: getLiveMaxAgeMinutes(),
          batchSize: getSyncBatchSize(),
          fastTier: TIER_DATASETS.fast,
          crons: ["*/3 rgm", "*/5 live", "*/15 scheduler", "*/15 alerts live", "*/4h daily", "weekly Sunday"],
        }
      : undefined,
  };
}
