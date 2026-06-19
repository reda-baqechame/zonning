import { NextRequest, NextResponse } from "next/server";
import {
  getDatasetIdsForTier,
  DATASETS,
  type DatasetId,
} from "@/lib/datasets/registry";
import { syncDataset } from "@/lib/sync/runner";
import {
  syncNextBatch,
  syncLiveWatch,
  syncRgmWatch,
  alertIfCriticalStale,
} from "@/lib/sync/scheduler";
import { runBootstrapBatches } from "@/lib/sync/bootstrap";
import { getSyncBatchSize } from "@/lib/sync/live-watch";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { isSyncAutomationEnabled } from "@/lib/env";

export const maxDuration = 300;

async function runPostSyncAlerts() {
  await alertIfCriticalStale();
  const quality = await import("@/lib/sync/quality");
  await quality.alertIfQualityAnomalies();
}

export async function GET(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSyncAutomationEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "SYNC_ENABLED=false" });
  }

  const { searchParams } = req.nextUrl;
  const tier = searchParams.get("tier");
  const mode = searchParams.get("mode");
  const dataset = searchParams.get("dataset") as DatasetId | null;

  if (dataset && dataset in DATASETS) {
    const result = await syncDataset(dataset);
    return NextResponse.json({ ok: result.ok, results: [result] });
  }

  if (mode === "live") {
    const { results, changed, skipped, synced } = await syncLiveWatch();
    const failed = results.filter((r) => !r.ok || r.error);
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    void runPostSyncAlerts();

    return NextResponse.json({
      ok: failed.length === 0,
      mode: "live",
      changed,
      skipped,
      synced,
      totalProcessed,
      results,
    });
  }

  if (mode === "rgm") {
    const { results, synced } = await syncRgmWatch();
    const failed = results.filter((r) => !r.ok || r.error);
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    return NextResponse.json({
      ok: failed.length === 0,
      mode: "rgm",
      synced,
      totalProcessed,
      results,
    });
  }

  if (mode === "bootstrap") {
    const rounds = parseInt(searchParams.get("rounds") ?? "6", 10);
    const { rounds: completed, totalSynced } = await runBootstrapBatches(
      Number.isFinite(rounds) ? rounds : 6
    );
    void runPostSyncAlerts();
    return NextResponse.json({
      ok: true,
      mode: "bootstrap",
      rounds: completed,
      totalSynced,
    });
  }

  if (!tier && (mode === "scheduler" || !mode)) {
    const { results, skipped } = await syncNextBatch();
    await runPostSyncAlerts();
    const failed = results.filter((r) => !r.ok || r.error);
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);

    return NextResponse.json({
      ok: failed.length === 0,
      mode: "scheduler",
      totalProcessed,
      skipped,
      results,
    });
  }

  if (tier === "all") {
    const batchSize = getSyncBatchSize();
    const allResults = [];
    let totalProcessed = 0;

    for (let i = 0; i < 4; i++) {
      const { results, skipped } = await syncNextBatch({ maxDatasets: batchSize });
      allResults.push(...results);
      totalProcessed += results.reduce((s, r) => s + r.processed, 0);
      if (results.length === 0 || skipped.length === results.length) break;
    }

    await runPostSyncAlerts();
    const failed = allResults.filter((r) => !r.ok || r.error);

    return NextResponse.json({
      ok: failed.length === 0,
      tier: "all",
      mode: "chunked",
      totalProcessed,
      results: allResults,
    });
  }

  const datasets = tier ? getDatasetIdsForTier(tier) : [];
  if (datasets.length === 0) {
    return NextResponse.json({ error: "Invalid tier or dataset" }, { status: 400 });
  }

  const results = [];
  let totalProcessed = 0;
  for (const id of datasets) {
    const result = await syncDataset(id);
    results.push(result);
    totalProcessed += result.processed;
  }

  await runPostSyncAlerts();
  const failed = results.filter((r) => !r.ok || r.error);

  return NextResponse.json({
    ok: failed.length === 0,
    tier,
    totalProcessed,
    results,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
