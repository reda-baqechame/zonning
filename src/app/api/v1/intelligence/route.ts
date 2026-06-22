import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { FREE_TEST_PRINCIPAL_ID, isFreeTestMode } from "@/lib/free-test";
import { getIntelligenceByAddress } from "@/lib/intelligence";
import { rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req.headers.get("authorization"), "verdict");
  if (!auth && !isFreeTestMode()) {
    return NextResponse.json(
      { error: "Invalid API key or missing intelligence scope (Équipe plan)" },
      { status: 401 }
    );
  }

  const principalId = auth?.orgId ?? FREE_TEST_PRINCIPAL_ID;
  const limited = await rateLimitAsync(`api:v1:intel:${principalId}`, 60, 60_000);
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
