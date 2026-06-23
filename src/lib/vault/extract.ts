/**
 * Document Intelligence Vault — extraction.
 *
 * Given the plain text of a tender/permit document a user legally downloaded
 * and uploaded privately, extract a structured action list: mandatory forms,
 * automatic-rejection clauses, insurance/bond requirements, RBQ/AMP/CNESST/
 * OQLF/Revenu-Québec requirements, deadlines, addenda, pricing sheet, and
 * submission method.
 *
 * Strategy: deterministic keyword/heuristic extraction (always works, no key
 * needed), augmented by the LLM client when OPENAI/ANTHROPIC is configured.
 * The deterministic layer is the source of truth; AI only enriches.
 *
 * Law 25 / PIPEDA: documents are user-private. This module never transmits
 * raw bytes — only extracted text — and callers must retain user ownership.
 */

import { completeJson, isLlmConfigured } from "@/lib/ai/client";

export type VaultTask = {
  id: string;
  title: string;
  detail: string;
  /** Whether missing this causes automatic rejection. */
  blocker: boolean;
  category:
    | "mandatory_form"
    | "rejection_clause"
    | "insurance"
    | "bond"
    | "rbq"
    | "amp"
    | "cnesst"
    | "oqlf"
    | "revenu_quebec"
    | "equality_employment"
    | "deadline"
    | "addenda"
    | "pricing"
    | "submission"
    | "contact"
    | "other";
};

export type VaultExtraction = {
  title: string | null;
  buyer: string | null;
  region: string | null;
  contractType: string | null;
  estimatedValue: number | null;
  deadlines: string[];
  requiredDocuments: string[];
  rejectionRisks: string[];
  insuranceRequirements: string[];
  bondRequirements: string[];
  requiresRbq: boolean;
  requiresAmp: boolean;
  cnesstRisk: boolean;
  oqlfRequirement: boolean;
  revenuQuebecRequired: boolean;
  equalityEmployment: boolean;
  submissionMethod: string | null;
  contactRules: string[];
  addendaNoted: boolean;
  tasks: VaultTask[];
  blockerCount: number;
  extractedWithAi: boolean;
};

const RX = {
  date: /\b(\d{1,2}[\s/-](?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc|january|february|march|april|may|june|july|august|september|october|november|december)[a-zé.]*[\s/-]\d{2,4})\b/gi,
  money: /\$\s?[\d\s.,]{2,}/g,
  email: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
};

function matches(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** Deterministic extraction from document text. */
export function extractDeterministic(rawText: string): VaultExtraction {
  const text = rawText.slice(0, 60_000);
  const lower = text.toLowerCase();

  const deadlines = unique(text.match(RX.date) ?? []);
  const insuranceRequirements: string[] = [];
  const bondRequirements: string[] = [];
  const rejectionRisks: string[] = [];
  const requiredDocuments: string[] = [];
  const contactRules: string[] = [];

  const requiresRbq = matches(lower, ["rbq", "régie du bâtiment", "regie du batiment", "licence d'entrepreneur"]);
  const requiresAmp = matches(lower, ["amp", "autorisation de contracter", "autorité des marchés publics"]);
  const cnesstRisk = matches(lower, ["cnesst", "main-d'oeuvre", "main d'oeuvre", "permis d'agence", "location d'employés"]);
  const oqlfRequirement = matches(lower, ["oqlf", "francisation", "loi 101"]);
  const revenuQuebecRequired = matches(lower, ["revenu québec", "revenu quebec", "attestation fiscale"]);
  const equalityEmployment = matches(lower, ["égalité emploi", "egalite emploi", "equal employment", "equality employment"]);

  if (matches(lower, ["assurance responsabilité", "liability insurance", "certificat d'assurance"])) {
    insuranceRequirements.push("Certificat d'assurance responsabilité civile (vérifier le montant minimum exigé).");
  }
  if (matches(lower, ["cautionnement", "bid bond", "caution de soumission"])) {
    bondRequirements.push("Cautionnement de soumission (bid bond) exigé — vérifier le pourcentage et la capacité.");
  }
  if (matches(lower, ["caution de bonne exécution", "performance bond", "caution d'exécution"])) {
    bondRequirements.push("Caution de bonne exécution (performance bond) exigée.");
  }
  if (matches(lower, ["rejet automatique", "automatic rejection", "sera rejetée", "shall be rejected", "non recevable"])) {
    rejectionRisks.push("Le document mentionne des clauses de rejet automatique — respecter scrupuleusement chaque exigence obligatoire.");
  }
  if (matches(lower, ["déclaration de lobbyisme", "déclaration d'absence de collusion", "lobbying declaration", "non-collusion"])) {
    requiredDocuments.push("Déclaration de lobbyisme / non-collusion obligatoire.");
  }
  if (matches(lower, ["attestation de revenu québec", "attestation de conformité fiscale"])) {
    requiredDocuments.push("Attestation Revenu Québec.");
  }
  if (matches(lower, ["addenda", "addendum", "avenant"])) {
    // captured below
  }

  const submissionMethod = matches(lower, ["électronique", "electronic", "seao"])
    ? "Dépôt électronique (vérifier le mode exact sur l'avis)."
    : matches(lower, ["sous pli cacheté", "sealed", "en main propre"])
      ? "Dépôt sous pli cacheté (vérifier l'adresse et l'heure)."
      : null;

  const emails = unique(text.match(RX.email) ?? []);
  if (emails.length > 0) {
    contactRules.push(`Contact(s) mentionné(s): ${emails.slice(0, 3).join(", ")}. Ne contacter que selon les règles de l'appel.`);
  }

  const addendaNoted = matches(lower, ["addenda", "addendum", "avenant"]);

  // Build the ordered task board.
  const tasks = buildTasks({
    requiresRbq,
    requiresAmp,
    revenuQuebecRequired,
    cnesstRisk,
    oqlfRequirement,
    equalityEmployment,
    hasBond: bondRequirements.length > 0,
    hasInsurance: insuranceRequirements.length > 0,
    addendaNoted,
    deadlines,
    requiredDocuments,
    rejectionRisks,
    submissionMethod,
  });

  return {
    title: extractTitle(text),
    buyer: extractBuyer(text),
    region: matches(lower, ["québec", "montreal", "montréal", "laval"]) ? "Québec" : null,
    contractType: null,
    estimatedValue: extractValue(text),
    deadlines,
    requiredDocuments,
    rejectionRisks,
    insuranceRequirements,
    bondRequirements,
    requiresRbq,
    requiresAmp,
    cnesstRisk,
    oqlfRequirement,
    revenuQuebecRequired,
    equalityEmployment,
    submissionMethod,
    contactRules,
    addendaNoted,
    tasks,
    blockerCount: tasks.filter((t) => t.blocker).length,
    extractedWithAi: false,
  };
}

/** AI-enriched extraction layered on the deterministic baseline. */
export async function extractWithAi(text: string): Promise<VaultExtraction | null> {
  if (!isLlmConfigured()) return null;
  const baseline = extractDeterministic(text);
  const slice = text.slice(0, 20_000);

  const ai = await completeJson<{
    title?: string | null;
    buyer?: string | null;
    contractType?: string | null;
    region?: string | null;
    estimatedValue?: number | null;
    deadlines?: string[];
    requiredDocuments?: string[];
    rejectionRisks?: string[];
    insuranceRequirements?: string[];
    bondRequirements?: string[];
    submissionMethod?: string | null;
    tasks?: { title: string; detail: string; blocker: boolean; category: VaultTask["category"] }[];
  }>([
    {
      role: "system",
      content:
        "Tu es un expert en marchés publics québécois. À partir du texte d'un document d'appel d'offres, extrais les actions obligatoires. Réponds en JSON.",
    },
    {
      role: "user",
      content:
        `Texte du document (tronqué):\n"""\n${slice}\n"""\n\n` +
        `Extrais: title, buyer, contractType, region, estimatedValue, deadlines[], requiredDocuments[], rejectionRisks[], insuranceRequirements[], bondRequirements[], submissionMethod, tasks[]{title,detail,blocker,category}.`,
    },
  ]);

  if (!ai) return baseline;

  const tasks: VaultTask[] = (ai.tasks ?? []).map((t, i) => ({
    id: `ai-${i}`,
    title: t.title,
    detail: t.detail,
    blocker: Boolean(t.blocker),
    category: t.category ?? "other",
  }));

  return {
    ...baseline,
    title: ai.title ?? baseline.title,
    buyer: ai.buyer ?? baseline.buyer,
    contractType: ai.contractType ?? baseline.contractType,
    region: ai.region ?? baseline.region,
    estimatedValue: ai.estimatedValue ?? baseline.estimatedValue,
    deadlines: unique([...(ai.deadlines ?? []), ...baseline.deadlines]),
    requiredDocuments: unique([...(ai.requiredDocuments ?? []), ...baseline.requiredDocuments]),
    rejectionRisks: unique([...(ai.rejectionRisks ?? []), ...baseline.rejectionRisks]),
    insuranceRequirements: unique([...(ai.insuranceRequirements ?? []), ...baseline.insuranceRequirements]),
    bondRequirements: unique([...(ai.bondRequirements ?? []), ...baseline.bondRequirements]),
    submissionMethod: ai.submissionMethod ?? baseline.submissionMethod,
    tasks: tasks.length > 0 ? tasks : baseline.tasks,
    blockerCount: tasks.filter((t) => t.blocker).length || baseline.blockerCount,
    extractedWithAi: true,
  };
}

function buildTasks(ctx: {
  requiresRbq: boolean;
  requiresAmp: boolean;
  revenuQuebecRequired: boolean;
  cnesstRisk: boolean;
  oqlfRequirement: boolean;
  equalityEmployment: boolean;
  hasBond: boolean;
  hasInsurance: boolean;
  addendaNoted: boolean;
  deadlines: string[];
  requiredDocuments: string[];
  rejectionRisks: string[];
  submissionMethod: string | null;
}): VaultTask[] {
  const tasks: VaultTask[] = [];
  const push = (t: Omit<VaultTask, "id">) => tasks.push({ id: `t-${tasks.length + 1}`, ...t });

  if (ctx.requiresRbq) {
    push({ title: "Confirmer la classe RBQ", detail: "Le document exige une licence RBQ couvrant les travaux.", blocker: true, category: "rbq" });
  }
  if (ctx.requiresAmp) {
    push({ title: "Vérifier l'autorisation AMP", detail: "AMP requise — doit être détenue à la date de dépôt.", blocker: true, category: "amp" });
  }
  if (ctx.revenuQuebecRequired) {
    push({ title: "Joindre l'attestation Revenu Québec", detail: "Attestation fiscale obligatoire.", blocker: true, category: "revenu_quebec" });
  }
  if (ctx.cnesstRisk) {
    push({ title: "Vérifier le risque CNESST", detail: "Le document touche la main-d'oeuvre/sécurité — permis d'agence possible.", blocker: false, category: "cnesst" });
  }
  if (ctx.oqlfRequirement) {
    push({ title: "Vérifier l'exigence OQLF", detail: "Francisation possible selon le document.", blocker: false, category: "oqlf" });
  }
  if (ctx.equalityEmployment) {
    push({ title: "Remplir le formulaire égalité emploi", detail: "Formulaire d'égalité en emploi requis.", blocker: false, category: "equality_employment" });
  }
  if (ctx.hasBond) {
    push({ title: "Préparer le cautionnement", detail: "Cautionnement exigé — confirmer le montant.", blocker: true, category: "bond" });
  }
  if (ctx.hasInsurance) {
    push({ title: "Joindre le certificat d'assurance", detail: "Certificat d'assurance avec le montant minimum requis.", blocker: false, category: "insurance" });
  }
  for (const doc of ctx.requiredDocuments) {
    push({ title: "Document obligatoire", detail: doc, blocker: true, category: "mandatory_form" });
  }
  for (const risk of ctx.rejectionRisks) {
    push({ title: "Risque de rejet", detail: risk, blocker: true, category: "rejection_clause" });
  }
  if (ctx.addendaNoted) {
    push({ title: "Vérifier tous les addendas", detail: "Des addendas sont mentionnés — les télécharger avant de soumettre.", blocker: false, category: "addenda" });
  }
  if (ctx.deadlines.length > 0) {
    push({ title: "Respecter les échéances", detail: `Échéance(s): ${ctx.deadlines.slice(0, 3).join(" ; ")}`, blocker: true, category: "deadline" });
  }
  if (ctx.submissionMethod) {
    push({ title: "Soumettre selon le mode requis", detail: ctx.submissionMethod, blocker: true, category: "submission" });
  } else {
    push({ title: "Confirmer le mode de dépôt", detail: "Mode de soumission non détecté clairement — vérifier l'avis.", blocker: false, category: "submission" });
  }
  return tasks;
}

function extractTitle(text: string): string | null {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 8 && l.length < 200);
  return firstLine ?? null;
}

function extractBuyer(text: string): string | null {
  const m = text.match(/(?:organisme|acheteur|pour le compte de|buyer|ministère)\s*:?\s*([^\n]{3,80})/i);
  return m?.[1]?.trim() ?? null;
}

function extractValue(text: string): number | null {
  const m = text.match(/(?:valeur estim|montant|estimated value|budget)\s*:?\s*\$?\s*([\d\s.,]{2,})/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function unique(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}
