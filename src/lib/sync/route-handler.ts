import { NextRequest, NextResponse } from "next/server";
import { assertSyncAuthorized } from "@/lib/sync/auth";
import type { SyncResult } from "@/lib/sync/runner";

export async function handleSyncRequest(
  req: NextRequest,
  run: () => Promise<SyncResult | { results: SyncResult[]; totalProcessed: number; ok?: boolean }>
) {
  const denied = assertSyncAuthorized(req);
  if (denied) return denied;

  const result = await run();
  return NextResponse.json(result);
}
