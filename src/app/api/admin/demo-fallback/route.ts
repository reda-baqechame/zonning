import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { getRequestId } from "@/lib/request-id";
import {
  ensureDemoFallback,
  clearDemoFallbackMarker,
  getDataModeStatus,
} from "@/lib/sync/demo-fallback";

/** Inspect the current data mode (admin only). */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(await getDataModeStatus());
}

/**
 * Seed demo-fallback content into an empty database, or clear the demo marker.
 * Body/query: ?action=clear to remove the marker; default seeds when empty.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:admin-demo:${user.id}:${ip}`, 5, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const action = req.nextUrl.searchParams.get("action");
  if (action === "clear") {
    await clearDemoFallbackMarker();
    auditLog({
      action: "admin.demo-fallback.clear",
      actorId: user.id,
      actorEmail: user.email,
      ip,
      requestId: getRequestId(req),
    });
    return NextResponse.json({ cleared: true });
  }

  const result = await ensureDemoFallback();
  auditLog({
    action: "admin.demo-fallback.seed",
    actorId: user.id,
    actorEmail: user.email,
    ip,
    requestId: getRequestId(req),
    metadata: result,
  });
  return NextResponse.json(result);
}
