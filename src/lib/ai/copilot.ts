/**
 * AI bid-draft / SEAO copilot.
 *
 * For a tender or permit, draft a bid response / outreach / qualification note
 * grounded in the user's RBQ profile + the dossier context. Beats Soumissio
 * ($249–599/mo, SEAO-only) by adding permit + property + RBQ context.
 *
 * Graceful fallback: deterministic templates when no LLM key — the copilot
 * still produces a structured, useful draft, never a blank.
 */

import { prisma } from "@/lib/prisma";
import { complete, isLlmConfigured } from "@/lib/ai/client";

export type CopilotKind = "bid" | "outreach" | "qualification";

export interface CopilotInput {
  kind: CopilotKind;
  /** Tender or permit id. */
  itemId: string;
  itemType: "tender" | "permit";
  /** User profile context (name, company, RBQ class, trades, region). */
  user?: {
    name?: string | null;
    companyName?: string | null;
    rbqLicenseClass?: string | null;
    trades?: string | null;
  };
  locale: "fr" | "en";
}

export interface CopilotResult {
  draft: string;
  kind: CopilotKind;
  generatedBy: "llm" | "deterministic";
  warnings: string[];
}

export async function draftCopilot(input: CopilotInput): Promise<CopilotResult> {
  const context = await loadContext(input);
  const warnings: string[] = [];

  if (!isLlmConfigured()) {
    return { draft: deterministicDraft(input, context), kind: input.kind, generatedBy: "deterministic", warnings: ["LLM non configuré — modèle déterministe utilisé."] };
  }

  const fr = input.locale === "fr";
  const system = fr
    ? "Tu es un assistant d'affaires pour entrepreneurs québécois. Rédige un brouillon professionnel, concis et concret en français. N'invente jamais de chiffres; utilise uniquement le contexte fourni. Termine par 3 points à vérifier avant l'envoi."
    : "You are a business assistant for Quebec contractors. Draft a professional, concise, concrete response. Never invent figures; use only the provided context. End with 3 points to verify before sending.";

  const prompt = buildPrompt(input, context, fr);
  const result = await complete(
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    { maxTokens: 700, temperature: 0.4 }
  );

  if (!result) {
    return { draft: deterministicDraft(input, context), kind: input.kind, generatedBy: "deterministic", warnings: ["LLM indisponible — modèle déterministe utilisé."] };
  }

  if (!context.found) warnings.push(fr ? "Élément introuvable — brouillon générique." : "Item not found — generic draft.");
  return { draft: result.text, kind: input.kind, generatedBy: "llm", warnings };
}

async function loadContext(input: CopilotInput) {
  if (input.itemType === "tender") {
    const t = await prisma.tender.findFirst({ where: { OR: [{ id: input.itemId }, { externalId: input.itemId }] } });
    if (!t) return { found: false };
    // Recent similar awards for grounding.
    const similar = t.category
      ? await prisma.tenderAward.findMany({ where: { category: t.category }, orderBy: { awardDate: "desc" }, take: 3 })
      : [];
    return {
      found: true,
      title: t.title,
      organization: t.organization,
      category: t.category,
      region: t.region,
      estimatedValue: t.estimatedValue,
      closesAt: t.closesAt,
      requiresAmp: t.requiresAmp,
      description: (t.description ?? t.summary ?? "").slice(0, 1500),
      similarAwards: similar.map((a) => ({ winner: a.winnerName, amount: a.awardAmount, date: a.awardDate })),
      sourceUrl: t.sourceUrl,
    };
  }
  const p = await prisma.permit.findFirst({ where: { OR: [{ id: input.itemId }, { permitNumber: input.itemId }, { externalId: input.itemId }] } });
  if (!p) return { found: false };
  return {
    found: true,
    title: `${p.permitType}${p.workType ? ` · ${p.workType}` : ""}`,
    organization: null,
    address: p.address,
    city: p.city,
    estimatedValue: p.estimatedCost,
    applicant: p.applicantName,
    requiredRbqClasses: p.requiredRbqClasses,
    sourceUrl: p.sourceUrl,
  };
}

function buildPrompt(input: CopilotInput, ctx: Record<string, unknown>, fr: boolean): string {
  const user = input.user;
  const profile = [
    user?.companyName && `Entreprise: ${user.companyName}`,
    user?.name && `Contact: ${user.name}`,
    user?.rbqLicenseClass && `Classe RBQ: ${user.rbqLicenseClass}`,
    user?.trades && `Corps de métier: ${user.trades}`,
  ]
    .filter(Boolean)
    .join("\n");

  const ctxLines = Object.entries(ctx)
    .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? JSON.stringify(v) : v}`)
    .join("\n");

  const kindLabel =
    input.kind === "bid"
      ? fr
        ? "une proposition de soumission"
        : "a bid proposal"
      : input.kind === "outreach"
        ? fr
          ? "un courriel de démarchage au demandeur"
          : "an outreach email to the applicant"
        : fr
          ? "une note de qualification (devrais-je soumissionner?)"
          : "a qualification note (should I bid?)";

  return `${fr ? "Rédige" : "Draft"} ${kindLabel}.

Profil de l'entrepreneur:
${profile || "(profil non spécifié)"}

Contexte (${input.itemType}):
${ctxLines}

Source: ${ctx.sourceUrl ?? "(publique)"}`;
}

function deterministicDraft(input: CopilotInput, ctx: Record<string, unknown>): string {
  const fr = input.locale === "fr";
  if (!ctx.found) {
    return fr
      ? "Élément introuvable. Vérifiez l'identifiant et réessayez.\n\nÀ vérifier avant l'envoi:\n- Identifiant correct\n- Élément toujours actif\n- Délai de soumission respecté"
      : "Item not found. Check the identifier and retry.\n\nTo verify:\n- Correct identifier\n- Item still active\n- Submission deadline met";
  }
  const title = (ctx.title as string) ?? "(titre)";
  const org = (ctx.organization as string) ?? (ctx.applicant as string) ?? (ctx.city as string) ?? "";
  const estVal = ctx.estimatedValue as number | undefined;
  const value = estVal ? `${estVal.toLocaleString("fr-CA")} $` : "non spécifié";

  if (input.kind === "qualification") {
    return fr
      ? `Qualification — ${title}\n\nValeur: ${value}\nMandataire/demandeur: ${org || "non spécifié"}\n\nRecommandation préliminaire: évaluer l'adéquation RBQ et la capacité avant de soumissionner.\n\nÀ vérifier:\n- Correspondance classe RBQ / travaux requis\n- Capacité et disponibilité à la date de clôture\n- Exigences AMP le cas échéant`
      : `Qualification — ${title}\n\nValue: ${value}\nBuyer/applicant: ${org || "n/a"}\n\nPreliminary recommendation: assess RBQ fit and capacity before bidding.\n\nTo verify:\n- RBQ class vs required work\n- Capacity and availability at close date\n- AMP requirements if applicable`;
  }

  const greeting = fr ? "Bonjour," : "Hello,";
  const intro = fr
    ? `Suite à la publication de « ${title} »${org ? ` par ${org}` : ""}, notre équipe souhaite manifester son intérêt.`
    : `Following the publication of "${title}"${org ? ` by ${org}` : ""}, our team wishes to express interest.`;
  const body = fr
    ? `Notre entreprise détient les licences et assurances requises et dispose de l'expérience pertinente pour réaliser ces travaux. Nous sommes disponibles pour une rencontre technique et pouvons fournir références et soumission détaillée.`
    : `Our company holds the required licenses and insurance and has relevant experience to complete this work. We are available for a technical meeting and can provide references and a detailed bid.`;
  const close = fr
    ? `Cordialement,\n${input.user?.companyName ?? "[Votre entreprise]"}\n${input.user?.name ?? "[Nom]"} · RBQ ${input.user?.rbqLicenseClass ?? "[classe]"}`
    : `Regards,\n${input.user?.companyName ?? "[Your company]"}\n${input.user?.name ?? "[Name]"} · RBQ ${input.user?.rbqLicenseClass ?? "[class]"}`;
  const verify = fr
    ? "\n\nÀ vérifier avant l'envoi:\n- Date limite de soumission\n- Documents exigés\n- Valeur estimée et portée exacte"
    : "\n\nTo verify before sending:\n- Submission deadline\n- Required documents\n- Estimated value and exact scope";

  return [greeting, "", intro, "", body, "", close, verify].join("\n");
}
