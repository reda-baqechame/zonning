import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { buildRuntimeTruth } from "@/lib/runtime-truth";

export const dynamic = "force-dynamic";

/**
 * Full runtime-truth dashboard payload. Restricted: admin session OR a valid
 * CRON_SECRET (so cron/monitoring can poll it). Exposes dataset ids, per-city
 * counts, critical/stale lists, PostGIS + cron mode — none of which is public.
 */
export async function GET(req: NextRequest) {
  const cronAuthorized = isSyncAuthorized(req);
  let authorized = cronAuthorized;
  if (!authorized) {
    const user = await getSessionUser();
    authorized = Boolean(user && isAdminEmail(user.email));
  }
  if (!authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const truth = await buildRuntimeTruth();
  return NextResponse.json(truth);
}
