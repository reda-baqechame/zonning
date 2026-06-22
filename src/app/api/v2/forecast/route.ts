import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { forecastMarket, opportunityAging } from "@/lib/forecast/engine";

/**
 * GET /api/v2/forecast?window=90&borough=Rosemont
 *
 * Market-heat forecasts (heating/cooling boroughs, 4-week projection) and
 * opportunity-aging curves. Directional model output with confidence bands.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:forecast:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const window = Math.min(365, Math.max(30, Number(sp.get("window")) || 90));
  const borough = sp.get("borough") ?? undefined;

  try {
    const [market, aging] = await Promise.all([forecastMarket(window), opportunityAging(borough)]);
    return NextResponse.json({ market, aging }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch (err) {
    console.error("[forecast] failed", err);
    return NextResponse.json({ error: "Échec de la prévision." }, { status: 500 });
  }
}
