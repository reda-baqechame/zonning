import { NextRequest, NextResponse } from "next/server";
import {
  getIntelligenceByAddress,
  getIntelligenceByMatricule,
} from "@/lib/intelligence";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { clampQuery } from "@/lib/query-params";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:intelligence:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("intelligence");
  const { searchParams } = req.nextUrl;
  const matricule = clampQuery(searchParams.get("matricule"), 20);
  const address = clampQuery(searchParams.get("address"), 300);
  const borough = clampQuery(searchParams.get("borough"), 100);

  if (matricule) {
    const intel = await getIntelligenceByMatricule(matricule);
    if (!intel) {
      return NextResponse.json({ error: "Matricule not found" }, { status: 404 });
    }
    return NextResponse.json({ intelligence: intel });
  }

  if (address) {
    const intel = await getIntelligenceByAddress(address, borough);
    return NextResponse.json({ intelligence: intel });
  }

  return NextResponse.json(
    { error: "Provide matricule or address query param" },
    { status: 400 }
  );
}
