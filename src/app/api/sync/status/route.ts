import { NextRequest, NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/sync/runner";
import { DATASETS } from "@/lib/datasets/registry";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = await rateLimitAsync(`api:sync-status:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const status = await getSyncStatus();
  const authorized = isSyncAuthorized(req);

  if (!authorized) {
    return NextResponse.json({
      datasetCount: Object.keys(DATASETS).length,
      states: status.states.map((state) => ({
        datasetId: state.datasetId,
        status: state.status,
        recordsProcessed: state.recordsProcessed,
        lastRunAt: state.lastRunAt,
        lastSuccessAt: state.lastSuccessAt,
        sourceModifiedAt: state.sourceModifiedAt,
      })),
      counts: status.counts,
    });
  }

  return NextResponse.json({
    datasets: DATASETS,
    datasetCount: Object.keys(DATASETS).length,
    ...status,
  });
}
