import { NextRequest, NextResponse } from "next/server";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { isSyncAutomationEnabled } from "@/lib/env";
import { detectWatchChanges } from "@/lib/watchlist/engine";

export const maxDuration = 60;

/**
 * GET /api/cron/watchlist
 *
 * Diff every pinned watch item against its last-seen snapshot and emit
 * notifications for detected changes (new permit, sale, infraction, award).
 * Protected by CRON_SECRET like the other cron routes.
 */
export async function GET(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSyncAutomationEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "SYNC_ENABLED=false" });
  }

  try {
    const created = await detectWatchChanges();
    return NextResponse.json({ ok: true, notificationsCreated: created });
  } catch (err) {
    console.error("[cron/watchlist] failed", err);
    return NextResponse.json({ ok: false, error: "watchlist detection failed" }, { status: 500 });
  }
}
