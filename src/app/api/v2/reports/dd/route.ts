import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { generatePropertyReport, generateContractorReport } from "@/lib/reports/dd-pdf";

/**
 * GET /api/v2/reports/dd?kind=property&matricule=...
 * GET /api/v2/reports/dd?kind=contractor&by=rbq&value=1234-5678-01
 *
 * Generates and streams a branded investigation-report PDF.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:dd-report:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind");

  try {
    let result: { pdf: Uint8Array; filename: string } | null = null;

    if (kind === "property") {
      const matricule = sp.get("matricule")?.trim();
      if (!matricule) return NextResponse.json({ error: "matricule required" }, { status: 400 });
      result = await generatePropertyReport(matricule);
    } else if (kind === "contractor") {
      const by = (sp.get("by") as "rbq" | "neq") ?? "rbq";
      const value = sp.get("value")?.trim();
      if (!value) return NextResponse.json({ error: "value required" }, { status: 400 });
      result = await generateContractorReport(value, by);
    } else {
      return NextResponse.json({ error: "kind must be property or contractor" }, { status: 400 });
    }

    if (!result) {
      return NextResponse.json({ error: "Aucune donnée pour générer le rapport." }, { status: 404 });
    }

    return new NextResponse(result.pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[dd-report] failed", err);
    return NextResponse.json({ error: "Échec de la génération du rapport." }, { status: 500 });
  }
}
