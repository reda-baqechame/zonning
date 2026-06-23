import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { buildGovernmentReadinessPassport, profileFromUser } from "@/lib/readiness-passport";

/**
 * GET /api/passport?locale=en
 * Returns the calling user's Government Readiness Passport (score, status,
 * ready/missing/blockers, next actions, official sites, and the ordered
 * mission board). Requires an authenticated session.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:passport:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr";
  const passport = buildGovernmentReadinessPassport(profileFromUser(user), locale);

  return NextResponse.json({ passport });
}
