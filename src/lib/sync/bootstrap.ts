import { syncNextBatch } from "./scheduler";
import { findNeverSynced, getSyncBatchSize } from "./live-watch";

let bootstrapInFlight = false;

const MAX_BOOTSTRAP_ROUNDS = 4;

/**
 * On cold start, sync datasets that have never succeeded (multiple batches).
 */
export async function bootstrapSyncIfNeeded(): Promise<void> {
  if (process.env.SYNC_ENABLED === "false") return;
  if (bootstrapInFlight) return;
  bootstrapInFlight = true;

  try {
    for (let round = 0; round < MAX_BOOTSTRAP_ROUNDS; round++) {
      const never = await findNeverSynced();
      if (never.length === 0) break;

      await syncNextBatch({
        maxDatasets: Math.min(never.length, getSyncBatchSize()),
        preferIds: never,
      });
    }
  } catch (e) {
    bootstrapInFlight = false;
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureException(e, { tags: { component: "bootstrap" } });
    }
    throw e;
  }
}

export async function runBootstrapBatches(maxRounds = 6): Promise<{
  rounds: number;
  totalSynced: number;
}> {
  let totalSynced = 0;
  let rounds = 0;

  for (let i = 0; i < maxRounds; i++) {
    const never = await findNeverSynced();
    if (never.length === 0) break;

    const { results } = await syncNextBatch({
      maxDatasets: getSyncBatchSize(),
      preferIds: never,
    });
    rounds++;
    totalSynced += results.reduce((s, r) => s + r.processed, 0);
  }

  return { rounds, totalSynced };
}
