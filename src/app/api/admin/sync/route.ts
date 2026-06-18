import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { syncDataset } from "@/lib/sync/runner";
import type { DatasetId } from "@/lib/datasets/registry";
import { ALL_DATASET_IDS } from "@/lib/datasets/registry";
import { isAdminEmail } from "@/lib/admin";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { getRequestId } from "@/lib/request-id";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:admin-sync:${user.id}:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const dataset = req.nextUrl.searchParams.get("dataset") as DatasetId | null;
  if (!dataset || !ALL_DATASET_IDS.includes(dataset)) {
    return NextResponse.json({ error: "Invalid dataset" }, { status: 400 });
  }

  const result = await syncDataset(dataset);
  auditLog({
    action: "admin.sync",
    resource: dataset,
    actorId: user.id,
    actorEmail: user.email,
    ip,
    requestId: getRequestId(req),
    metadata: { ok: result.ok, processed: result.processed },
  });
  return NextResponse.json(result);
}
