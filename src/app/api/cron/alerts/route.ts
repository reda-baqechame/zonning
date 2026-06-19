import { NextRequest, NextResponse } from "next/server";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { sendAlertEmails, sendWeeklyDigests, sendAlertEmailsForWindow } from "@/lib/email/alerts";
import { subMinutes } from "date-fns";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "alerts";
  const mode = searchParams.get("mode");

  if (type === "digest") {
    const result = await sendWeeklyDigests();
    return NextResponse.json({ ok: true, type: "digest", ...result });
  }

  if (mode === "live") {
    const alerts = await sendAlertEmailsForWindow({
      since: subMinutes(new Date(), 20),
      live: true,
    });
    return NextResponse.json({ ok: true, type: "alerts", mode: "live", alerts });
  }

  const alerts = await sendAlertEmails();
  const digest =
    new Date().getUTCDay() === 1
      ? await sendWeeklyDigests()
      : { sent: 0, errors: [] as string[] };

  return NextResponse.json({
    ok: true,
    type: "alerts",
    alerts,
    digest,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
