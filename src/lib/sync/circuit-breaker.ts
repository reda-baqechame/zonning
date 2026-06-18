import { subMinutes } from "date-fns";
import { DATASETS, type DatasetId } from "@/lib/datasets/registry";
import { prisma } from "@/lib/prisma";

const FAILURE_THRESHOLD = 3;
const COOLDOWN_MINUTES = 15;

/** Skip datasets that failed repeatedly within the cooldown window. */
export async function isCircuitOpen(datasetId: DatasetId): Promise<boolean> {
  const cfg = DATASETS[datasetId];
  const since = subMinutes(new Date(), COOLDOWN_MINUTES);

  const recentErrors = await prisma.syncLog.count({
    where: {
      source: cfg.syncSource,
      status: "error",
      ranAt: { gte: since },
    },
  });

  if (recentErrors < FAILURE_THRESHOLD) return false;

  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  if (!state?.lastRunAt) return false;

  return state.lastRunAt >= since && state.status === "error";
}

export async function recordCircuitSkip(datasetId: DatasetId): Promise<void> {
  await prisma.syncState.upsert({
    where: { datasetId },
    create: { datasetId, status: "idle", lastRunAt: new Date() },
    update: { lastRunAt: new Date() },
  });
}
