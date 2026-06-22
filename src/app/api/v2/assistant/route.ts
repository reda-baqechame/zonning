import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildSiteDossier } from "@/lib/api/v2";
import {
  enforceV2RateLimit,
  isV2Access,
  requireV2Access,
} from "@/lib/api/v2-access";

const requestSchema = z.object({
  question: z.string().trim().min(3).max(600),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(120).optional(),
  borough: z.string().trim().min(2).max(120).optional(),
  locale: z.enum(["fr", "en"]).default("fr"),
  project: z
    .object({
      desiredUse: z.string().trim().min(2).max(160).optional(),
      proposedFloors: z.number().int().positive().max(500).optional(),
      proposedUnits: z.number().int().positive().max(10_000).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const access = await requireV2Access(req, "verdict");
  if (!isV2Access(access)) return access;

  const limited = await enforceV2RateLimit(req, "assistant", access, 30);
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid assistant request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const dossier = await buildSiteDossier({
    address: input.address,
    city: input.city,
    borough: input.borough,
    project: input.project,
  });
  const zoning = dossier.zoningAnalysis;
  const citations = dossier.signals
    .filter((signal) => Boolean(signal.source.url))
    .map((signal) => ({
      title: signal.source.title,
      url: signal.source.url,
      confidence: signal.confidence,
      refreshedAt: signal.refreshedAt ?? signal.source.refreshedAt ?? null,
    }))
    .concat(
      dossier.permits.map((permit) => ({
        title: permit.source.title,
        url: permit.source.url,
        confidence: permit.confidence,
        refreshedAt: permit.source.refreshedAt ?? null,
      })),
    );

  const evidenceCount = dossier.signals.length + dossier.permits.length;
  if (evidenceCount === 0) {
    const answer =
      input.locale === "fr"
        ? "Aucune preuve publique indexée ne correspond de façon suffisamment précise à cette adresse. Je ne peux donc pas conclure sur la conformité, le potentiel constructible ou les contraintes du lot."
        : "No indexed public evidence matches this address precisely enough. I cannot conclude on compliance, development capacity, or parcel constraints.";
    return NextResponse.json(
      {
        status: "insufficient_data",
        mode: "deterministic_evidence_summary",
        answer,
        question: input.question,
        dossier,
        citations: [],
        limitations: dossier.limitations,
        recommendedNextAction:
          input.locale === "fr"
            ? "Confirmer le lot cadastral et consulter la grille de zonage et les règlements municipaux en vigueur."
            : "Confirm the cadastral lot and consult the current municipal zoning grid and bylaws.",
      },
      { status: 422 },
    );
  }

  const zoningSummary = zoning
    ? input.locale === "fr"
      ? `Analyse de zonage ${zoning.status}, décision ${zoning.decision}, confiance ${zoning.confidence} %. La conformité peut être conclue: ${zoning.canConcludeCompliance ? "oui" : "non"}.`
      : `Zoning analysis is ${zoning.status}, decision ${zoning.decision}, confidence ${zoning.confidence}%. Compliance can be concluded: ${zoning.canConcludeCompliance ? "yes" : "no"}.`
    : input.locale === "fr"
      ? "Aucune analyse de zonage suffisamment étayée n'est disponible."
      : "No sufficiently supported zoning analysis is available.";
  const answer =
    input.locale === "fr"
      ? `${evidenceCount} élément(s) de preuve publique sourcé(s) ont été trouvés pour ${dossier.address}. ${zoningSummary} Le verdict opérationnel est ${dossier.verdict}; il doit être lu avec les limites et les sources ci-dessous.`
      : `${evidenceCount} sourced public evidence item(s) were found for ${dossier.address}. ${zoningSummary} The operational verdict is ${dossier.verdict}; read it with the limitations and sources below.`;

  return NextResponse.json({
    status: "grounded",
    mode: "deterministic_evidence_summary",
    answer,
    question: input.question,
    dossier,
    citations,
    limitations: dossier.limitations,
    recommendedNextAction:
      input.locale === "fr"
        ? "Examiner chaque source et faire confirmer les règles applicables par la municipalité avant de déposer ou d'investir."
        : "Review every source and confirm applicable rules with the municipality before filing or investing.",
  });
}
