import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { listNotifications, markNotificationRead } from "@/lib/watchlist/engine";

/**
 * GET /api/v2/watchlist/notifications?unreadOnly=1&limit=30
 * POST /api/v2/watchlist/notifications  { id }  → mark read
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const limited = await rateLimitAsync(`api:watchlist-notif:${user.id}:${clientIp(req)}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const notifications = await listNotifications(user.id, {
    unreadOnly: sp.get("unreadOnly") === "1",
    limit: Number(sp.get("limit")) || 30,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await markNotificationRead(user.id, body.id);
  return NextResponse.json({ status: "read" });
}
