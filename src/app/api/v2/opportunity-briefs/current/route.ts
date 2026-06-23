import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { buildQuebecOpportunityBrief } from "@/lib/quebec-qualification";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  const limited = await rateLimitAsync(
    `api:v2:brief-current:${user?.id ?? clientIp(req)}`,
    45,
    60_000,
  );
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
  const locale = req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr";
  const brief = await buildQuebecOpportunityBrief({ user, locale });
  return NextResponse.json({ version: "v2", brief });
}
