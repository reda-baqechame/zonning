import { checkSourceChanged } from "@/lib/datasets/change-detection";
import {
  ALL_DATASET_IDS,
  DATASETS,
  getActiveDatasetIds,
  getSyncEnabledDatasetIds,
  isDatasetSyncEnabled,
  TIER_DATASETS,
  type DatasetId,
} from "@/lib/datasets/registry";
import {
  RGM_REALTIME_IDS,
  sortQuebecPriority,
} from "@/lib/quebec-coverage";
import { prisma } from "@/lib/prisma";

function computeStaleRatio(
  lastSuccessAt: Date | null | undefined,
  refreshIntervalMinutes: number
): number {
  if (!lastSuccessAt) return Infinity;
  const ageMs = Date.now() - lastSuccessAt.getTime();
  const intervalMs = refreshIntervalMinutes * 60 * 1000;
  return ageMs / intervalMs;
}

/** Revenue-critical datasets polled every live cron (5 min). */
export const LIVE_WATCH_IDS: DatasetId[] = TIER_DATASETS.fast.filter(isDatasetSyncEnabled);

export function getSyncBatchSize(): number {
  const n = parseInt(process.env.SYNC_BATCH_SIZE ?? "8", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, ALL_DATASET_IDS.length) : 8;
}

export function getLiveMaxAgeMinutes(): number {
  const n = parseInt(process.env.LIVE_SYNC_INTERVAL_MINUTES ?? "5", 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/**
 * Poll CKAN `last_modified` and return datasets whose government source
 * changed since our last successful ingest.
 */
export async function findDatasetsWithSourceChanges(
  datasetIds: DatasetId[] = LIVE_WATCH_IDS
): Promise<DatasetId[]> {
  const states = await prisma.syncState.findMany({
    where: { datasetId: { in: datasetIds } },
  });
  const stateMap = new Map(states.map((s) => [s.datasetId, s]));

  const checks = await Promise.all(
    datasetIds.map(async (datasetId): Promise<DatasetId | null> => {
      const state = stateMap.get(datasetId);
      if (!state?.lastSuccessAt) return datasetId;

      try {
        const { changed } = await checkSourceChanged(
          datasetId,
          state.sourceModifiedAt
        );
        return changed ? datasetId : null;
      } catch {
        const recentErrors = state?.lastRunAt
          ? Date.now() - state.lastRunAt.getTime() < 15 * 60 * 1000
          : false;
        return recentErrors ? null : datasetId;
      }
    })
  );

  return checks.filter((id): id is DatasetId => id !== null && isDatasetSyncEnabled(id));
}

/** Datasets that have never completed a successful sync. */
export async function findNeverSynced(): Promise<DatasetId[]> {
  const states = await prisma.syncState.findMany({
    where: { lastSuccessAt: { not: null } },
    select: { datasetId: true },
  });
  const synced = new Set(states.map((s) => s.datasetId));
  return getActiveDatasetIds().filter((id) => !synced.has(id));
}

export async function markSourceChecked(datasetId: DatasetId): Promise<void> {
  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  if (!state?.sourceModifiedAt) return;

  const { changed, sourceModifiedAt } = await checkSourceChanged(
    datasetId,
    state.sourceModifiedAt
  );
  if (!changed) {
    await prisma.syncState.update({
      where: { datasetId },
      data: { lastSuccessAt: new Date(), lastRunAt: new Date(), status: "idle" },
    });
  } else if (sourceModifiedAt) {
    await prisma.syncState.update({
      where: { datasetId },
      data: { sourceModifiedAt },
    });
  }
}

export function sortByPriority(ids: DatasetId[]): DatasetId[] {
  const priority = [
    ...RGM_REALTIME_IDS,
    ...LIVE_WATCH_IDS,
    ...TIER_DATASETS.daily,
    ...TIER_DATASETS.weekly,
  ];
  return sortQuebecPriority(
    [...ids].sort(
      (a, b) => priority.indexOf(a) - priority.indexOf(b) || a.localeCompare(b)
    )
  );
}

/** Fast-tier datasets overdue for refresh (time-based, not only CKAN delta). */
export async function findStaleLiveDatasets(): Promise<DatasetId[]> {
  const states = await prisma.syncState.findMany({
    where: { datasetId: { in: LIVE_WATCH_IDS } },
  });
  const stateMap = new Map(states.map((s) => [s.datasetId, s]));
  const stale: DatasetId[] = [];

  for (const datasetId of LIVE_WATCH_IDS) {
    const cfg = DATASETS[datasetId];
    const state = stateMap.get(datasetId);
    if (state?.status === "running") continue;
    if (!state?.lastSuccessAt) {
      stale.push(datasetId);
      continue;
    }
    const ratio = computeStaleRatio(state.lastSuccessAt, cfg.refreshIntervalMinutes);
    if (ratio >= 1) stale.push(datasetId);
  }

  return sortByPriority(stale);
}

/** RGM trio + SEAO — poll at half the configured refresh interval for lower scheduled latency. */
export async function findRgmDueForSync(): Promise<DatasetId[]> {
  const states = await prisma.syncState.findMany({
    where: { datasetId: { in: RGM_REALTIME_IDS } },
  });
  const stateMap = new Map(states.map((s) => [s.datasetId, s]));
  const due: DatasetId[] = [];

  for (const datasetId of RGM_REALTIME_IDS) {
    const cfg = DATASETS[datasetId];
    const state = stateMap.get(datasetId);
    if (state?.status === "running") continue;
    if (!state?.lastSuccessAt) {
      due.push(datasetId);
      continue;
    }
    const ratio = computeStaleRatio(state.lastSuccessAt, cfg.refreshIntervalMinutes);
    if (ratio >= 0.5) due.push(datasetId);
  }

  return sortByPriority(due);
}

/** Datasets on bootstrap allowlist — probe CKAN each live cycle for newly published resources. */
export const CKAN_PROBE_ALLOWLIST: DatasetId[] = ([
  "permits-laval",
  "permits-longueuil",
  "permits-gatineau",
  "permits-levis",
  "permits-sherbrooke",
  "permits-trois-rivieres",
  "permits-saguenay",
  "permits-terrebonne",
  "permits-repentigny",
  "permits-brossard",
  "permits-saint-jean-richelieu",
  "permits-drummondville",
  "permits-saint-jerome",
  "permits-granby",
  "permits-saint-hyacinthe",
  "projects-brossard",
  "transactions-2025",
  "contracts-boroughs",
  "zoning-sherbrooke",
  "zoning-quebec",
  "zoning-laval",
  "zoning-longueuil",
  "toronto-permits",
] as DatasetId[]).filter(isDatasetSyncEnabled);

/** Returns allowlisted datasets whose CKAN resource is now available (was empty). */
export async function findAllowlistedSourcesNowLive(): Promise<DatasetId[]> {
  const { fetchCkanResourceUrl } = await import("@/lib/datasets/client");
  const probeIds = CKAN_PROBE_ALLOWLIST.filter((id) => getSyncEnabledDatasetIds().includes(id));
  const states = await prisma.syncState.findMany({
    where: { datasetId: { in: probeIds } },
  });
  const stateMap = new Map(states.map((s) => [s.datasetId, s]));

  const live: DatasetId[] = [];
  for (const datasetId of probeIds) {
    const cfg = DATASETS[datasetId];
    if (datasetId === "permits-levis" && process.env.LEVIS_PERMITS_URL) {
      live.push(datasetId);
      continue;
    }
    if (datasetId === "permits-longueuil" && process.env.LONGUEUIL_PERMITS_URL) {
      live.push(datasetId);
      continue;
    }
    if (
      (datasetId === "permits-sherbrooke" && process.env.SHERBROOKE_PERMITS_URL) ||
      (datasetId === "permits-saguenay" && process.env.SAGUENAY_PERMITS_URL) ||
      (datasetId === "permits-trois-rivieres" && process.env.V3R_PERMITS_URL) ||
      (datasetId === "permits-terrebonne" && process.env.TERREBONNE_PERMITS_URL) ||
      (datasetId === "permits-repentigny" && process.env.REPENTIGNY_PERMITS_URL) ||
      (datasetId === "permits-brossard" && process.env.BROSSARD_PERMITS_URL) ||
      (datasetId === "permits-saint-jean-richelieu" && process.env.SJR_PERMITS_URL) ||
      (datasetId === "permits-drummondville" && process.env.DRUMMONDVILLE_PERMITS_URL) ||
      (datasetId === "permits-saint-jerome" && process.env.SAINT_JEROME_PERMITS_URL) ||
      (datasetId === "permits-granby" && process.env.GRANBY_PERMITS_URL) ||
      (datasetId === "permits-saint-hyacinthe" && process.env.SAINT_HYACINTHE_PERMITS_URL)
    ) {
      live.push(datasetId);
      continue;
    }
    if (datasetId === "toronto-permits" && process.env.EXPAND_ONTARIO === "true") {
      live.push(datasetId);
      continue;
    }
    try {
      const url = await fetchCkanResourceUrl(
        cfg.ckanId,
        cfg.preferredFormat,
        cfg.ckanHost ?? "quebec"
      );
      if (!url) continue;
      const state = stateMap.get(datasetId);
      const neverSynced = !state?.lastSuccessAt;
      const lastEmpty = state?.recordsProcessed === 0;
      if (neverSynced || lastEmpty) live.push(datasetId);
    } catch {
      /* probe failed */
    }
  }
  return live;
}
