import { NextRequest } from "next/server";
import { handleSyncRequest } from "@/lib/sync/route-handler";
import { syncAll } from "@/lib/sync/runner";

export async function POST(req: NextRequest) {
  return handleSyncRequest(req, async () => {
    const { results, totalProcessed } = await syncAll();
    const failed = results.filter((r) => !r.ok || r.error);
    return { ok: failed.length === 0, totalProcessed, results };
  });
}
