import { NextRequest, NextResponse } from "next/server";
import {
  getIntelligenceByAddress,
  getIntelligenceByMatricule,
  hasIntelligenceData,
} from "@/lib/intelligence";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { clampQuery } from "@/lib/query-params";
import { buildZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";

function optionalPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 500 ? parsed : undefined;
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:intelligence:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { searchParams } = req.nextUrl;
  const matricule = clampQuery(searchParams.get("matricule"), 20);
  const address = clampQuery(searchParams.get("address"), 300);
  const borough = clampQuery(searchParams.get("borough"), 100);
  const city = clampQuery(searchParams.get("city"), 100);
  const project = {
    desiredUse: clampQuery(searchParams.get("desiredUse"), 160),
    proposedFloors: optionalPositiveInt(searchParams.get("proposedFloors")),
    proposedUnits: optionalPositiveInt(searchParams.get("proposedUnits")),
  };

  if (matricule) {
    const intel = await getIntelligenceByMatricule(matricule);
    if (!intel) {
      return NextResponse.json({
        intelligence: null,
        hasData: false,
        message: "No indexed data matched this matricule.",
      });
    }
    return NextResponse.json({
      intelligence: intel,
      zoningAnalysis: buildZoningExpertAnalysis(intel, project),
      hasData: hasIntelligenceData(intel),
    });
  }

  if (address) {
    const intel = await getIntelligenceByAddress(address, borough, city ?? undefined);
    const hasData = hasIntelligenceData(intel);
    return NextResponse.json({
      intelligence: intel,
      zoningAnalysis: buildZoningExpertAnalysis(intel, project),
      hasData,
      message: hasData ? undefined : "No indexed intelligence matched this address.",
    });
  }

  return NextResponse.json(
    { error: "Provide matricule or address query param" },
    { status: 400 }
  );
}
