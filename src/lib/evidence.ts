/**
 * Evidence & provenance helpers.
 *
 * The defining trust mechanic of an intelligence platform: every number,
 * verdict and score traces back to a source record. These helpers build
 * Evidence objects from ingested rows so the UI can render a clickable chain.
 */

import type { Evidence } from "@/lib/ontology/types";

/** Human-readable labels for the dataset ids used across the app. */
export const DATASET_LABELS: Record<string, string> = {
  permits: "Permis de construction — Montréal (RGM)",
  "permits-laval": "Permis de construction — Laval",
  "permits-quebec": "Permis de construction — Québec",
  "permits-longueuil": "Permis de construction — Longueuil",
  "permits-gatineau": "Permis de construction — Gatineau",
  tenders: "Appels d'offres — SEAO",
  awards: "Adjudications — SEAO",
  rbq: "Registre des détenteurs de licence — RBQ",
  "rbq-infractions": "Infractions RBQ",
  "amp-registry": "Registre AMP",
  transactions: "Ventes immobilières — Montréal",
  "transactions-2023": "Ventes immobilières 2023",
  "transactions-2025": "Ventes immobilières 2025",
  assessment: "Rôle d'évaluation foncière",
  "property-tax": "Taxes municipales",
  contamination: "Terrains contaminés — Montréal",
  "contamination-gtc": "Terrains contaminés — GTC provincial",
  heritage: "Patrimoine — Montréal",
  "heritage-eip": "Patrimoine — EIP",
  "heritage-lpc": "Patrimoine — LPC",
  "pum2050-zoning": "Zonage PUM2050",
  zoning: "Zonage — points",
  "zoning-quebec": "Zonage — Québec",
  roadworks: "Travaux routiers — Montréal",
  "development-projects": "Projets de développement",
  commercial: "Locaux commerciaux vacants",
  suppliers: "Fournisseurs municipaux",
  contracts: "Contrats municipaux",
  registre: "Registre des entreprises (NEQ)",
  "inspection-violations-mtl": "Inspections municipales — Montréal",
};

export function datasetLabel(datasetId?: string): string {
  if (!datasetId) return "Source publique";
  return DATASET_LABELS[datasetId] ?? datasetId;
}

/**
 * Build an Evidence object from a raw ingested row. Most rows carry a
 * `sourceUrl` and `sourceFetchedAt`; we lift them into the provenance layer.
 */
export function evidenceFromRow(
  datasetId: string | undefined,
  row: {
    id?: string;
    externalId?: string | null;
    sourceUrl?: string | null;
    sourceFetchedAt?: Date | string | null;
  },
  confidence?: number
): Evidence {
  return {
    source: datasetLabel(datasetId),
    datasetId,
    recordId: row.id ?? row.externalId ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    fetchedAt: row.sourceFetchedAt ? new Date(row.sourceFetchedAt).toISOString() : undefined,
    confidence,
  };
}

/** Evidence for a derived/inferred fact (e.g. a score, a forecast, an entity merge). */
export function inferredEvidence(
  method: string,
  confidence: number,
  inputs: Evidence[] = []
): Evidence {
  return {
    source: method,
    confidence,
    recordId: inputs.map((i) => i.recordId).filter(Boolean).join(",") || undefined,
    fetchedAt: new Date().toISOString(),
  };
}

/** Confidence band label for display. */
export function confidenceBand(confidence?: number): {
  label: string;
  tone: "success" | "warning" | "danger";
} {
  if (confidence == null) return { label: "Vérifié", tone: "success" };
  if (confidence >= 0.8) return { label: "Forte confiance", tone: "success" };
  if (confidence >= 0.5) return { label: "Confiance modérée", tone: "warning" };
  return { label: "À vérifier", tone: "danger" };
}
