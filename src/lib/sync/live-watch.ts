import { checkSourceChanged } from "@/lib/datasets/change-detection";
import {
  ALL_DATASET_IDS,
  DATASETS,
  getActiveDatasetIds,
  TIER_DATASETS,
  type DatasetId,
} from "@/lib/datasets/registry";
import { prisma } from "@/lib/prisma";

/** Revenue-critical datasets polled every live cron (5 min). */
export const LIVE_WATCH_IDS: DatasetId[] = TIER_DATASETS.fast;

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

  return checks.filter((id): id is DatasetId => id !== null);
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
  const priority = [...LIVE_WATCH_IDS, ...TIER_DATASETS.daily, ...TIER_DATASETS.weekly];
  return [...ids].sort(
    (a, b) => priority.indexOf(a) - priority.indexOf(b) || a.localeCompare(b)
  );
}

/** Datasets on bootstrap allowlist — probe CKAN each live cycle for newly published resources. */
export const CKAN_PROBE_ALLOWLIST: DatasetId[] = [
  "permits-gatineau",
  "permits-levis",
  "projects-brossard",
  "transactions-2025",
  "contracts-boroughs",
  "toronto-permits",
];

/** Returns allowlisted datasets whose CKAN resource is now available (was empty). */
export async function findAllowlistedSourcesNowLive(): Promise<DatasetId[]> {
  const { fetchCkanResourceUrl } = await import("@/lib/datasets/client");
  const states = await prisma.syncState.findMany({
    where: { datasetId: { in: CKAN_PROBE_ALLOWLIST } },
  });
  const stateMap = new Map(states.map((s) => [s.datasetId, s]));

  const live: DatasetId[] = [];
  for (const datasetId of CKAN_PROBE_ALLOWLIST) {
    const cfg = DATASETS[datasetId];
    if (datasetId === "permits-levis" && process.env.LEVIS_PERMITS_URL) {
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
