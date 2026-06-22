import { NextRequest, NextResponse } from "next/server";
import { buildSiteDossier } from "@/lib/api/v2";
import { parsePositiveSiteInt, parseV2SiteQuery } from "@/lib/api/v2-site-query";
import { enforceV2RateLimit, isV2Access, requireV2Access } from "@/lib/api/v2-access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireV2Access(req, "verdict");
  if (!isV2Access(access)) return access;
  const limited = await enforceV2RateLimit(req, "site-zoning", access, 60);
  if (limited) return limited;

  const { id } = await params;
  const parsed = parseV2SiteQuery(req, id);
  if (!parsed.success) return NextResponse.json({ error: "Invalid site query" }, { status: 400 });
  const dossier = await buildSiteDossier({
    ...parsed.data,
    project: {
      desiredUse: req.nextUrl.searchParams.get("desiredUse"),
      proposedFloors: parsePositiveSiteInt(req.nextUrl.searchParams.get("proposedFloors"), 500),
      proposedUnits: parsePositiveSiteInt(req.nextUrl.searchParams.get("proposedUnits"), 10_000),
    },
  });
  const analysis = dossier.zoningAnalysis;
  const primaryEvidence = analysis?.evidence[0];

  return NextResponse.json({
    siteId: dossier.id,
    status: analysis?.status ?? "unavailable",
    decision: analysis?.decision ?? "not_determined",
    canConcludeCompliance: analysis?.canConcludeCompliance ?? false,
    confidence: analysis?.confidence ?? 0,
    analysis: analysis ?? null,
    zoning: dossier.zoning ?? null,
    source: primaryEvidence
      ? {
          title: primaryEvidence.label,
          url: primaryEvidence.sourceUrl,
          refreshedAt: primaryEvidence.sourceFetchedAt,
          scope: primaryEvidence.scope,
        }
      : null,
    disclaimer:
      "No zoning compliance conclusion is issued without parcel-level municipal bylaw evidence and the required dimensional, use, overlay, and amendment checks.",
    limitations: dossier.limitations,
  });
}
