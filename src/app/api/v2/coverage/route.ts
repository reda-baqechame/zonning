import { NextRequest, NextResponse } from "next/server";
import { buildCoveragePayload } from "@/lib/api/v2";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = await rateLimitAsync(`api:v2:coverage:${clientIp(req)}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
  return NextResponse.json(await buildCoveragePayload());
}
