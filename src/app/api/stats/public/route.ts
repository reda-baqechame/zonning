import { NextRequest, NextResponse } from "next/server";
import { fetchMarketPulseStats } from "@/lib/market-pulse";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:stats:${ip}`, 120, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const stats = await fetchMarketPulseStats();
  return NextResponse.json(stats);
}
