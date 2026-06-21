/**
 * Natural-language intelligence query runner.
 *
 * Turns a plain-language question ("Propriétés 2-4 logements à Rosemont avec
 * un permis déposé ce mois-ci, évaluation sous la moyenne des ventes récentes,
 * sans contrainte patrimoniale ni terrain contaminé") into a structured query,
 * executes it against the indexed Quebec data, and returns a cited answer.
 *
 * Flow: NL → LLM produces a structured QueryIntent (or deterministic parse
 * fallback) → execute against Prisma → assemble a grounded answer with
 * evidence. No claim without a source; if the LLM is unavailable, the
 * deterministic parser still handles common patterns.
 */

import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/datasets/geo";
import { completeJson } from "@/lib/ai/client";
import { evidenceFromRow } from "@/lib/evidence";
import type { Evidence } from "@/lib/ontology/types";

export type QueryIntent = {
  /** What the user is looking for. */
  target: "properties" | "permits" | "tenders" | "contractors" | "companies";
  /** Municipal borough/city filter. */
  borough?: string;
  city?: string;
  region?: string;
  /** Building type / trade / category filter. */
  buildingType?: string;
  trade?: string;
  category?: string;
  /** Cost range. */
  minCost?: number;
  maxCost?: number;
  /** Time window in days (e.g. "this month" → 30). */
  withinDays?: number;
  /** Constraint exclusions. */
  excludeHeritage?: boolean;
  excludeContaminated?: boolean;
  /** Value signals. */
  undervalued?: boolean;
  /** Number of results to return. */
  limit?: number;
};

export type QueryResultItem = {
  id: string;
  kind: QueryIntent["target"];
  title: string;
  subtitle?: string;
  details: Record<string, string | number | boolean | null>;
  evidence: Evidence;
  /** Optional matricule so the UI can link to the investigation canvas. */
  matricule?: string;
};

export type QueryAnswer = {
  status: "grounded" | "insufficient_data" | "unconfigured";
  intent: QueryIntent;
  results: QueryResultItem[];
  answer: string;
  limitations: string[];
  recommendedNextAction: string;
};

// ---- Deterministic NL parser (fallback when no LLM) ------------------------

const TIME_PATTERNS: { re: RegExp; days: number }[] = [
  { re: /aujourd'hui|today/i, days: 1 },
  { re: /cette semaine|this week/i, days: 7 },
  { re: /ce mois|this month|30 (derniers )?jours|30 days/i, days: 30 },
  { re: /90 (derniers )?jours|90 days|trois mois/i, days: 90 },
  { re: /cette année|this year|365/i, days: 365 },
];

export function parseIntentDeterministic(question: string): QueryIntent {
  const q = question.toLowerCase();
  const intent: QueryIntent = { target: "properties", limit: 20 };

  if (/(permis|permit)/.test(q)) intent.target = "permits";
  else if (/(appel d'offres|appel doffres|tender|seao|marché)/.test(q)) intent.target = "tenders";
  else if (/(entrepreneur|contractor|détenteur|rbq)/.test(q)) intent.target = "contractors";
  else if (/(entreprise|company|fournisseur|supplier|neq|registre)/.test(q)) intent.target = "companies";

  // Borough/city — look for "à X" / "dans X" / "à X"
  const boroughMatch = question.match(/(?:à|a|dans|in|de)\s+([A-ZÀ-Ÿ][a-zà-ÿ-]+(?:[-\s][A-ZÀ-Ÿa-zà-ÿ]+)*)/);
  if (boroughMatch) {
    const place = boroughMatch[1];
    if (/rosemont|plateau|ville-marie|verdun|saint-laurent|ahuntsic|mercier|cdn|côte-des-neiges/i.test(place)) {
      intent.borough = place;
    } else {
      intent.city = place;
    }
  }

  for (const { re, days } of TIME_PATTERNS) {
    if (re.test(q)) {
      intent.withinDays = days;
      break;
    }
  }

  if (/patrimonial|heritage|patrimoine/.test(q)) intent.excludeHeritage = true;
  if (/contaminé|contamine|contaminated|gtc/.test(q)) intent.excludeContaminated = true;
  if (/sous-évalu|undervalu|sous la moyenne|under valued/.test(q)) intent.undervalued = true;

  const unitsMatch = q.match(/(\d+)\s*(?:à|a|to|-)\s*(\d+)\s*logements|(\d+)\s*-\s*(\d+)\s*units/);
  if (unitsMatch) intent.buildingType = "logement";

  return intent;
}

async function parseIntentWithLlm(question: string, locale: "fr" | "en"): Promise<QueryIntent | null> {
  const system =
    "Tu es un parseur de requêtes pour une plateforme d'intelligence en construction au Québec. " +
    "Transforme la question de l'utilisateur en un objet JSON QueryIntent. " +
    "Ne remplis que les champs pertinents. Réponds UNIQUEMENT avec le JSON.";
  const schema = `{
  "target": "properties" | "permits" | "tenders" | "contractors" | "companies",
  "borough"?: string,   // arrondissement montréalais
  "city"?: string,
  "region"?: string,
  "buildingType"?: string,
  "trade"?: string,
  "category"?: string,
  "minCost"?: number,
  "maxCost"?: number,
  "withinDays"?: number,
  "excludeHeritage"?: boolean,
  "excludeContaminated"?: boolean,
  "undervalued"?: boolean,
  "limit"?: number
}`;
  const user = `Locale: ${locale}\nQuestion: ${question}\n\nRéponds avec un objet de cette forme:\n${schema}`;
  const parsed = await completeJson<QueryIntent>(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 400, temperature: 0 }
  );
  if (!parsed) return null;
  const { __provider, ...intent } = parsed as QueryIntent & { __provider?: string };
  void __provider;
  return intent;
}

// ---- Execution -------------------------------------------------------------

export async function runIntent(intent: QueryIntent): Promise<QueryResultItem[]> {
  switch (intent.target) {
    case "properties":
      return runPropertyQuery(intent);
    case "permits":
      return runPermitQuery(intent);
    case "tenders":
      return runTenderQuery(intent);
    case "contractors":
    case "companies":
      return runCompanyQuery(intent);
  }
}

async function runPropertyQuery(intent: QueryIntent): Promise<QueryResultItem[]> {
  const where: Record<string, unknown> = {};
  if (intent.borough) where.borough = { contains: intent.borough };
  if (intent.city) where.borough = { contains: intent.city };

  const units = await prisma.propertyUnit.findMany({
    where,
    take: Math.min(intent.limit ?? 50, 200),
    orderBy: { totalValue: "desc" },
  });

  // Filter by value signals + spatial constraints.
  let items: QueryResultItem[] = [];
  for (const u of units) {
    const item: QueryResultItem = {
      id: u.id,
      kind: "properties",
      title: u.address ?? `Matricule ${u.matricule}`,
      subtitle: u.borough ?? undefined,
      details: {
        matricule: u.matricule,
        totalValue: u.totalValue,
        yearBuilt: u.yearBuilt,
        units: u.units,
      },
      evidence: evidenceFromRow("assessment", u),
      matricule: u.matricule,
    };
    items.push(item);
  }

  if (intent.undervalued) {
    items = await filterUndervalued(items);
  }
  if (intent.excludeContaminated || intent.excludeHeritage) {
    items = await filterConstraints(items, intent);
  }

  return items.slice(0, intent.limit ?? 20);
}

async function filterUndervalued(items: QueryResultItem[]): Promise<QueryResultItem[]> {
  const out: QueryResultItem[] = [];
  for (const item of items) {
    const borough = item.subtitle;
    const totalValue = item.details.totalValue as number | undefined;
    if (!borough || !totalValue) continue;
    const comps = await prisma.propertyTransaction.findMany({
      where: { borough: { contains: borough }, salePrice: { not: null } },
      orderBy: { saleDate: "desc" },
      take: 100,
    });
    if (comps.length < 5) continue;
    const median = medianValue(comps.map((c) => c.salePrice!).filter((p) => p > 0));
    if (totalValue < median * 0.85) {
      item.details = { ...item.details, medianSale: median, undervaluationPct: Math.round((1 - totalValue / median) * 100) };
      out.push(item);
    }
  }
  return out;
}

async function filterConstraints(items: QueryResultItem[], intent: QueryIntent): Promise<QueryResultItem[]> {
  const out: QueryResultItem[] = [];
  for (const item of items) {
    const matricule = item.matricule;
    if (!matricule) {
      out.push(item);
      continue;
    }
    // Resolve coords from a permit on the parcel.
    const permit = await prisma.permit.findFirst({ where: { matricule, latitude: { not: null }, longitude: { not: null } } });
    if (!permit?.latitude || !permit?.longitude) {
      out.push(item);
      continue;
    }
    let blocked = false;
    if (intent.excludeContaminated) {
      const contaminated = await prisma.contaminatedSite.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        take: 1500,
      });
      if (contaminated.some((c) => c.latitude && c.longitude && haversineKm(permit.latitude!, permit.longitude!, c.latitude, c.longitude) <= 0.5)) {
        blocked = true;
      }
    }
    if (!blocked && intent.excludeHeritage) {
      const heritage = await prisma.heritageSite.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        take: 1500,
      });
      if (heritage.some((h) => h.latitude && h.longitude && haversineKm(permit.latitude!, permit.longitude!, h.latitude, h.longitude) <= 0.5)) {
        blocked = true;
      }
    }
    if (!blocked) out.push(item);
  }
  return out;
}

async function runPermitQuery(intent: QueryIntent): Promise<QueryResultItem[]> {
  const where: Record<string, unknown> = {};
  if (intent.borough) where.borough = { contains: intent.borough };
  if (intent.city) where.city = { contains: intent.city };
  if (intent.withinDays) {
    const since = new Date(Date.now() - intent.withinDays * 86_400_000);
    where.issueDate = { gte: since };
  }
  if (intent.minCost) where.estimatedCost = { gte: intent.minCost };
  if (intent.maxCost) where.estimatedCost = { ...(where.estimatedCost as object), lte: intent.maxCost };

  const permits = await prisma.permit.findMany({
    where,
    orderBy: { issueDate: "desc" },
    take: Math.min(intent.limit ?? 50, 200),
  });

  return permits.map((p) => ({
    id: p.id,
    kind: "permits" as const,
    title: `${p.permitType}${p.workType ? ` · ${p.workType}` : ""}`,
    subtitle: p.address,
    details: {
      city: p.city,
      estimatedCost: p.estimatedCost,
      issueDate: p.issueDate ? p.issueDate.toISOString().slice(0, 10) : null,
      applicant: p.applicantName ?? null,
      matricule: p.matricule ?? null,
    },
    evidence: evidenceFromRow("permits", p),
    matricule: p.matricule ?? undefined,
  }));
}

async function runTenderQuery(intent: QueryIntent): Promise<QueryResultItem[]> {
  const where: Record<string, unknown> = { closesAt: { gte: new Date() } };
  if (intent.category) where.category = { contains: intent.category };
  if (intent.region) where.region = { contains: intent.region };
  if (intent.minCost) where.estimatedValue = { gte: intent.minCost };

  const tenders = await prisma.tender.findMany({
    where,
    orderBy: { closesAt: "asc" },
    take: Math.min(intent.limit ?? 50, 200),
  });

  return tenders.map((t) => ({
    id: t.id,
    kind: "tenders" as const,
    title: t.title,
    subtitle: [t.organization, t.region].filter(Boolean).join(" · ") || undefined,
    details: {
      estimatedValue: t.estimatedValue,
      closesAt: t.closesAt ? t.closesAt.toISOString().slice(0, 10) : null,
      category: t.category ?? null,
      requiresAmp: t.requiresAmp,
    },
    evidence: evidenceFromRow("tenders", t),
  }));
}

async function runCompanyQuery(intent: QueryIntent): Promise<QueryResultItem[]> {
  const where: Record<string, unknown> = {};
  if (intent.city) where.city = { contains: intent.city };
  if (intent.region) where.region = { contains: intent.region };
  if (intent.trade) where.sector = { contains: intent.trade };

  const companies = await prisma.company.findMany({
    where,
    take: Math.min(intent.limit ?? 50, 200),
    orderBy: { name: "asc" },
  });

  return companies.map((c) => ({
    id: c.id,
    kind: "companies" as const,
    title: c.name,
    subtitle: [c.neq && `NEQ ${c.neq}`, c.rbqNumber && `RBQ ${c.rbqNumber}`].filter(Boolean).join(" · ") || undefined,
    details: {
      neq: c.neq ?? null,
      rbqNumber: c.rbqNumber ?? null,
      sector: c.sector ?? null,
      city: c.city ?? null,
    },
    evidence: evidenceFromRow("registre", { ...c, sourceFetchedAt: null }),
  }));
}

// ---- Public entry ----------------------------------------------------------

export async function answerQuestion(
  question: string,
  locale: "fr" | "en"
): Promise<QueryAnswer> {
  const intent = (await parseIntentWithLlm(question, locale)) ?? parseIntentDeterministic(question);
  const results = await runIntent(intent);

  if (results.length === 0) {
    return {
      status: "insufficient_data",
      intent,
      results: [],
      answer:
        locale === "fr"
          ? "Aucun résultat ne correspond à cette recherche dans les données actuellement indexées. Affinez la zone ou élargissez la fenêtre de temps."
          : "No results match this query in the currently indexed data. Narrow the area or widen the time window.",
      limitations: [
        locale === "fr"
          ? "La couverture municipale varie; certaines villes ne sont pas encore indexées."
          : "Municipal coverage varies; some cities are not yet indexed.",
      ],
      recommendedNextAction:
        locale === "fr"
          ? "Consultez la page Couverture pour voir les villes indexées, ou reformulez la recherche."
          : "Check the Coverage page for indexed cities, or rephrase the query.",
    };
  }

  const top = results.slice(0, 5);
  const answer =
    locale === "fr"
      ? `${results.length} résultat(s) trouvé(s) pour cette recherche. Voici les plus pertinents:\n` +
        top
          .map((r, i) => `${i + 1}. ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ""}`)
          .join("\n") +
        `\n\nChaque résultat renvoie à sa source publique; cliquez pour ouvrir la toile d'investigation.`
      : `${results.length} result(s) found. Top matches:\n` +
        top.map((r, i) => `${i + 1}. ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ""}`).join("\n");

  return {
    status: "grounded",
    intent,
    results,
    answer,
    limitations: [],
    recommendedNextAction:
      locale === "fr"
        ? "Cliquez sur un résultat pour l'investiguer dans la toile, ou exportez la liste."
        : "Click a result to investigate it in the canvas, or export the list.",
  };
}

function medianValue(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
