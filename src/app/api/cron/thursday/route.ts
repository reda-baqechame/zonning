import { NextRequest, NextResponse } from "next/server";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { sendThursdayCloseAlerts } from "@/lib/email/alerts";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendThursdayCloseAlerts();
  return NextResponse.json({ ok: true, type: "thursday", ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
