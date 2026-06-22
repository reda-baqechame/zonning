import { DATASETS, isDatasetSyncEnabled, type DatasetId } from "@/lib/datasets/registry";
import { prisma } from "@/lib/prisma";
import { syncDataset } from "@/lib/sync/runner";
import { getLiveMaxAgeMinutes } from "@/lib/sync/live-watch";

const backgroundSyncs = new Set<DatasetId>();
const MAX_CONCURRENT_BACKGROUND = 3;
let activeBackground = 0;
const waitQueue: (() => void)[] = [];

function acquireBackgroundSlot(): Promise<void> {
  if (activeBackground < MAX_CONCURRENT_BACKGROUND) {
    activeBackground++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeBackground++;
      resolve();
    });
  });
}

function releaseBackgroundSlot() {
  activeBackground = Math.max(0, activeBackground - 1);
  const next = waitQueue.shift();
  if (next) next();
}

export async function getDatasetFreshness(datasetId: DatasetId) {
  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  const cfg = DATASETS[datasetId];
  return {
    datasetId,
    label: cfg.label,
    lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
    lastRunAt: state?.lastRunAt?.toISOString() ?? null,
    status: state?.status ?? "never",
    recordsProcessed: state?.recordsProcessed ?? 0,
    refreshIntervalMinutes: cfg.refreshIntervalMinutes,
  };
}

function effectiveMaxAge(datasetId: DatasetId, override?: number): number {
  const cfg = DATASETS[datasetId];
  if (override !== undefined) return override;
  if (cfg.tier === "fast") {
    return Math.min(cfg.refreshIntervalMinutes, getLiveMaxAgeMinutes());
  }
  return cfg.refreshIntervalMinutes;
}

function isStale(
  lastSuccessAt: Date | null | undefined,
  datasetId: DatasetId,
  maxAgeMinutes?: number
): boolean {
  if (!lastSuccessAt) return true;
  const maxAge = effectiveMaxAge(datasetId, maxAgeMinutes);
  const ageMs = Date.now() - lastSuccessAt.getTime();
  return ageMs > maxAge * 60 * 1000;
}

export async function ensureFresh(
  datasetId: DatasetId,
  options?: { maxAgeMinutes?: number; background?: boolean }
): Promise<void> {
  if (process.env.SYNC_ENABLED === "false") return;
  if (!isDatasetSyncEnabled(datasetId)) return;

  const background = options?.background ?? true;

  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  if (!isStale(state?.lastSuccessAt, datasetId, options?.maxAgeMinutes)) return;
  if (backgroundSyncs.has(datasetId)) return;

  const run = async () => {
    backgroundSyncs.add(datasetId);
    await acquireBackgroundSlot();
    try {
      await syncDataset(datasetId);
    } finally {
      backgroundSyncs.delete(datasetId);
      releaseBackgroundSlot();
    }
  };

  if (background) {
    void run();
  } else {
    await run();
  }
}

export async function ensureFreshMany(
  datasetIds: DatasetId[],
  options?: { maxAgeMinutes?: number; background?: boolean }
): Promise<void> {
  const unique = [...new Set(datasetIds)].filter(isDatasetSyncEnabled);
  for (const id of unique) {
    void ensureFresh(id, options);
  }
}
