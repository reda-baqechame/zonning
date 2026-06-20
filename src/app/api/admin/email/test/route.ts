import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { sendEmail } from "@/lib/email/resend";
import { adminTestEmail } from "@/lib/email/templates";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const syncAuth = isSyncAuthorized(req);

  if (!syncAuth && (!user || !isAdminEmail(user.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimitAsync(
    `api:admin-email-test:${user?.id ?? "sync"}:${clientIp(req)}`,
    5,
    60 * 60_000,
  );
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const to = user?.email ?? process.env.ADMIN_EMAILS?.split(",")[0]?.trim();
  if (!to) {
    return NextResponse.json({ error: "No admin email configured" }, { status: 400 });
  }

  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr";
  const { subject, html } = adminTestEmail(locale, to);

  const result = await sendEmail({
    to,
    subject,
    html,
    userId: user?.id,
    type: "admin_test",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, messageId: result.id, to });
}
