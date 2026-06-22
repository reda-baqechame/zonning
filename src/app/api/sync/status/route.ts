import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSyncStatus } from "@/lib/sync/runner";
import { DATASETS } from "@/lib/datasets/registry";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = await rateLimitAsync(`api:sync-status:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const authorized = isSyncAuthorized(req);

  if (!authorized) {
    const states = await prisma.syncState.findMany({
      orderBy: { datasetId: "asc" },
      select: {
        datasetId: true,
        status: true,
        recordsProcessed: true,
        lastRunAt: true,
        lastSuccessAt: true,
        sourceModifiedAt: true,
      },
    });
    return NextResponse.json({
      datasetCount: Object.keys(DATASETS).length,
      states,
    });
  }

  const status = await getSyncStatus();

  return NextResponse.json({
    datasets: DATASETS,
    datasetCount: Object.keys(DATASETS).length,
    ...status,
  });
}
