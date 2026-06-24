import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { profileFromUser } from "@/lib/readiness-passport";
import { buildProposalPack } from "@/lib/proposals/build";
import { buildTenderOpportunityDossier } from "@/lib/opportunities/dossier";
import { computeTenderScore } from "@/lib/tender-score";
import type { VaultExtraction } from "@/lib/vault/extract";

/**
 * POST /api/proposals
 * Body: { tenderId: string, vaultDocumentId?: string, locale?: "fr" | "en" }
 *
 * Generates capability statement + proposal outline + pricing skeleton for a tender.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:proposals:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { tenderId?: unknown; vaultDocumentId?: unknown; locale?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenderId = typeof body.tenderId === "string" ? body.tenderId.trim() : "";
  if (!tenderId) {
    return NextResponse.json({ error: "tenderId is required." }, { status: 400 });
  }
  const locale = body.locale === "en" ? "en" : "fr";

  const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
  if (!tender) {
    return NextResponse.json({ error: "Tender not found." }, { status: 404 });
  }

  let vaultExtraction: VaultExtraction | null = null;
  const vaultDocumentId =
    typeof body.vaultDocumentId === "string" ? body.vaultDocumentId.trim() : "";
  if (vaultDocumentId) {
    const doc = await prisma.vaultDocument.findFirst({
      where: { id: vaultDocumentId, userId: user.id, deletedAt: null },
      select: { extraction: true },
    });
    if (doc?.extraction) {
      try {
        vaultExtraction =
          typeof doc.extraction === "string"
            ? (JSON.parse(doc.extraction) as VaultExtraction)
            : (doc.extraction as unknown as VaultExtraction);
      } catch {
        vaultExtraction = null;
      }
    }
  }

  const profile = profileFromUser(user);
  const ranking = computeTenderScore(tender, {
    trades: [],
    regions: [],
    ampAuthorized: user.ampAuthorized ?? false,
    minProjectCost: user.minProjectCost,
    maxProjectCost: user.maxProjectCost,
  });
  const dossier = buildTenderOpportunityDossier({
    tender,
    score: ranking.score,
    signals: [],
    ranking,
    locale,
    readinessProfile: profile,
  });

  const pack = buildProposalPack({
    profile,
    tender: {
      title: tender.title,
      organization: tender.organization,
      region: tender.region,
      category: tender.category,
      estimatedValue: tender.estimatedValue,
      sourceUrl: tender.sourceUrl,
    },
    mission: dossier.governmentMission,
    vaultExtraction,
    locale,
  });

  return NextResponse.json({
    tenderId: tender.id,
    tenderTitle: tender.title,
    decision: dossier.decision ?? null,
    ...pack,
  });
}
