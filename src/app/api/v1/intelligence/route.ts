import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { getIntelligenceByAddress } from "@/lib/intelligence";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  ensureFreshForKey("intelligence");
  const auth = await validateApiKey(req.headers.get("authorization"), "verdict");
  if (!auth) {
    return NextResponse.json(
      { error: "Invalid API key or missing intelligence scope (Équipe plan)" },
      { status: 401 }
    );
  }

  const limited = await rateLimitAsync(`api:v1:intel:${auth.orgId}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const borough = req.nextUrl.searchParams.get("borough") ?? undefined;
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  const intelligence = await getIntelligenceByAddress(address, borough, city);

  return NextResponse.json({ address, city, borough, intelligence });
}
