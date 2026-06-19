import { NextRequest, NextResponse } from "next/server";
import {
  getIntelligenceByAddress,
  getIntelligenceByMatricule,
  hasIntelligenceData,
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
  const city = clampQuery(searchParams.get("city"), 100);

  if (matricule) {
    const intel = await getIntelligenceByMatricule(matricule);
    if (!intel) {
      return NextResponse.json({
        intelligence: null,
        hasData: false,
        message:
          "Aucune donnée pour ce matricule. Il n'est pas encore dans nos jeux de données ingérés.",
      });
    }
    return NextResponse.json({ intelligence: intel, hasData: hasIntelligenceData(intel) });
  }

  if (address) {
    const intel = await getIntelligenceByAddress(address, borough, city ?? undefined);
    const hasData = hasIntelligenceData(intel);
    return NextResponse.json({
      intelligence: intel,
      hasData,
      ...(hasData
        ? {}
        : {
            message:
              "Aucune donnée pour cette adresse pour l'instant. Elle n'est pas encore couverte par nos jeux de données — réessayez après la prochaine synchronisation.",
          }),
    });
  }

  return NextResponse.json(
    { error: "Provide matricule or address query param" },
    { status: 400 }
  );
}
