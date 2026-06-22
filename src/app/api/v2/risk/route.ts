import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { assessPropertyRisk, assessContractorRisk } from "@/lib/risk/engine";

/**
 * GET /api/v2/risk?kind=property&matricule=...
 * GET /api/v2/risk?kind=contractor&by=rbq&value=1234-5678-01
 *
 * Returns a composite risk assessment with evidence-decomposed factors.
 */
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:risk:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const kind = sp.get("kind");

  try {
    if (kind === "property") {
      const matricule = sp.get("matricule")?.trim();
      if (!matricule) {
        return NextResponse.json({ error: "matricule required" }, { status: 400 });
      }
      const assessment = await assessPropertyRisk(matricule);
      if (!assessment) {
        return NextResponse.json({ error: "Matricule introuvable." }, { status: 404 });
      }
      return NextResponse.json(assessment, { headers: { "Cache-Control": "no-store" } });
    }

    if (kind === "contractor") {
      const by = (sp.get("by") as "rbq" | "neq") ?? "rbq";
      const value = sp.get("value")?.trim();
      if (!value) {
        return NextResponse.json({ error: "value required" }, { status: 400 });
      }
      const assessment = await assessContractorRisk(value, by);
      if (!assessment) {
        return NextResponse.json({ error: "Entrepreneur introuvable." }, { status: 404 });
      }
      return NextResponse.json(assessment, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "kind must be property or contractor" }, { status: 400 });
  } catch (err) {
    console.error("[risk] assessment failed", err);
    return NextResponse.json({ error: "Échec de l'évaluation du risque." }, { status: 500 });
  }
}
