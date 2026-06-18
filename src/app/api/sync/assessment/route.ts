import { NextRequest } from "next/server";
import { handleSyncRequest } from "@/lib/sync/route-handler";
import { syncAssessments } from "@/lib/sync/runner";

export async function POST(req: NextRequest) {
  return handleSyncRequest(req, () => syncAssessments());
}
