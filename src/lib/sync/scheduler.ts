import { prisma } from "@/lib/prisma";
import { checkSourceChanged } from "@/lib/datasets/change-detection";
import { DATASETS, getSyncEnabledDatasetIds, type DatasetId } from "@/lib/datasets/registry";
import { syncDataset, type SyncResult } from "./runner";
import {
  findDatasetsWithSourceChanges,
  findNeverSynced,
  findAllowlistedSourcesNowLive,
  findStaleLiveDatasets,
  findRgmDueForSync,
  getSyncBatchSize,
  LIVE_WATCH_IDS,
  sortByPriority,
} from "./live-watch";

const FAST_PRIORITY: DatasetId[] = LIVE_WATCH_IDS;

export type DatasetStaleness = {
  datasetId: DatasetId;
  label: string;
  stale: boolean;
  staleRatio: number;
  lastSuccessAt: Date | null;
  refreshIntervalMinutes: number;
  status: string;
  sourceChanged?: boolean;
};

export function computeStaleRatio(
  lastSuccessAt: Date | null | undefined,
  refreshIntervalMinutes: number
): number {
  if (!lastSuccessAt) return Infinity;
  const ageMs = Date.now() - lastSuccessAt.getTime();
  const intervalMs = refreshIntervalMinutes * 60 * 1000;
  return ageMs / intervalMs;
}

export async function getDatasetStaleness(): Promise<DatasetStaleness[]> {
  const states = await prisma.syncState.findMany();
  const stateMap = new Map(states.map((s) => [s.datasetId, s]));

  return getSyncEnabledDatasetIds().map((datasetId) => {
    const cfg = DATASETS[datasetId];
    const state = stateMap.get(datasetId);
    const staleRatio = computeStaleRatio(
      state?.lastSuccessAt,
      cfg.refreshIntervalMinutes
    );

    return {
      datasetId,
      label: cfg.label,
      stale: staleRatio >= 1,
      staleRatio,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      refreshIntervalMinutes: cfg.refreshIntervalMinutes,
      status: state?.status ?? "never",
    };
  });
}

export async function pickDatasetsToSync(
  maxDatasets = 3,
  exclude: DatasetId[] = []
): Promise<DatasetId[]> {
  const excluded = new Set(exclude);
  const ranked = await getDatasetStaleness();

  ranked.sort((a, b) => {
    if (a.stale !== b.stale) return a.stale ? -1 : 1;
    const aFast = FAST_PRIORITY.indexOf(a.datasetId);
    const bFast = FAST_PRIORITY.indexOf(b.datasetId);
    const aBoost = aFast >= 0 ? 0.5 : 0;
    const bBoost = bFast >= 0 ? 0.5 : 0;
    return b.staleRatio + bBoost - (a.staleRatio + aBoost);
  });

  const candidates = ranked.filter((r) => !excluded.has(r.datasetId));

  const stale = candidates.filter(
    (r) => r.stale && r.status !== "running"
  );
  if (stale.length === 0) {
    const neverSynced = candidates.filter((r) => r.status === "never");
    return neverSynced.slice(0, maxDatasets).map((r) => r.datasetId);
  }

  return stale.slice(0, maxDatasets).map((r) => r.datasetId);
}

export async function shouldSkipUnchangedSync(
  datasetId: DatasetId
): Promise<boolean> {
  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  if (!state?.sourceModifiedAt || !state.lastSuccessAt) return false;

  const { changed } = await checkSourceChanged(datasetId, state.sourceModifiedAt);
  return !changed;
}

async function skipUnchanged(datasetId: DatasetId): Promise<void> {
  await prisma.syncState.update({
    where: { datasetId },
    data: { lastRunAt: new Date(), lastSuccessAt: new Date(), status: "idle" },
  });
}

export async function syncNextBatch(options?: {
  maxDatasets?: number;
  preferIds?: DatasetId[];
}): Promise<{ results: SyncResult[]; skipped: DatasetId[] }> {
  const maxDatasets = options?.maxDatasets ?? getSyncBatchSize();
  const results: SyncResult[] = [];
  const skipped: DatasetId[] = [];
  const synced = new Set<DatasetId>();

  const changed = sortByPriority(
    await findDatasetsWithSourceChanges(getSyncEnabledDatasetIds())
  );
  const probed = await findAllowlistedSourcesNowLive();
  const never = await findNeverSynced();
  const prefer = sortByPriority(options?.preferIds ?? []);

  const queue: DatasetId[] = [];
  for (const id of [...prefer, ...changed, ...probed, ...never]) {
    if (!queue.includes(id)) queue.push(id);
  }

  const timePicked = await pickDatasetsToSync(maxDatasets, queue);
  for (const id of timePicked) {
    if (!queue.includes(id)) queue.push(id);
  }

  for (const datasetId of queue.slice(0, maxDatasets)) {
    if (synced.has(datasetId)) continue;

    const skip = await shouldSkipUnchangedSync(datasetId);
    if (skip && !changed.includes(datasetId) && !never.includes(datasetId) && !probed.includes(datasetId)) {
      skipped.push(datasetId);
      await skipUnchanged(datasetId);
      continue;
    }

    results.push(await syncDataset(datasetId));
    synced.add(datasetId);
  }

  return { results, skipped };
}

/** Live cron: sync fast-tier datasets when CKAN changed or refresh interval elapsed. */
export async function syncLiveWatch(): Promise<{
  results: SyncResult[];
  changed: DatasetId[];
  skipped: DatasetId[];
  synced: DatasetId[];
}> {
  const [changed, stale, rgmDue, probed] = await Promise.all([
    findDatasetsWithSourceChanges(LIVE_WATCH_IDS),
    findStaleLiveDatasets(),
    findRgmDueForSync(),
    findAllowlistedSourcesNowLive(),
  ]);

  const toSync = sortByPriority([
    ...new Set([...rgmDue, ...changed, ...stale, ...probed]),
  ]).slice(0, getSyncBatchSize());

  const results: SyncResult[] = [];
  const skipped: DatasetId[] = [];

  for (const datasetId of toSync) {
    results.push(await syncDataset(datasetId));
  }

  for (const datasetId of LIVE_WATCH_IDS) {
    if (toSync.includes(datasetId)) continue;
    const skip = await shouldSkipUnchangedSync(datasetId);
    if (skip) {
      skipped.push(datasetId);
      await skipUnchanged(datasetId);
    }
  }

  return { results, changed, skipped, synced: toSync };
}

export async function syncRgmWatch(): Promise<{
  results: SyncResult[];
  synced: DatasetId[];
}> {
  const due = await findRgmDueForSync();
  const results: SyncResult[] = [];
  for (const datasetId of due) {
    results.push(await syncDataset(datasetId));
  }
  return { results, synced: due };
}

export async function alertIfCriticalStale(): Promise<void> {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (admins.length === 0 || !process.env.RESEND_API_KEY) return;

  const ranked = await getDatasetStaleness();
  const critical = ranked.filter((r) => r.staleRatio >= 2 && r.status !== "running");
  if (critical.length === 0) return;

  const { sendEmail } = await import("@/lib/email/resend");
  const lines = critical
    .map((c) => `- ${c.label} (${c.datasetId}): ${c.staleRatio.toFixed(1)}× overdue`)
    .join("\n");

  const html = `<p>The following government datasets are overdue for sync:</p><pre>${lines}</pre><p>Auto-sync scheduler will retry. Check <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/sync/health">/api/sync/health</a>.</p>`;

  for (const to of admins) {
    await sendEmail({
      to,
      subject: `[ZONNING] ${critical.length} dataset(s) critically stale`,
      html,
    });
  }
}
