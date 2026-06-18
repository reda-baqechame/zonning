import { NextRequest, NextResponse } from "next/server";
import { getSyncStatus } from "@/lib/sync/runner";
import { DATASETS } from "@/lib/datasets/registry";
import { assertSyncAuthorized, isSyncAuthorized } from "@/lib/sync/auth";

export async function GET(req: NextRequest) {
  const denied = assertSyncAuthorized(req);
  if (denied) return denied;

  const status = await getSyncStatus();
  const authorized = isSyncAuthorized(req);

  return NextResponse.json({
    datasets: authorized ? DATASETS : undefined,
    datasetCount: Object.keys(DATASETS).length,
    ...status,
  });
}
