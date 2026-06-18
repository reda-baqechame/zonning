import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseFloatSafe } from "../parser";

export type PermitDelayRecord = {
  externalId: string;
  borough: string;
  phase?: string;
  medianDays?: number;
  targetDays?: number;
  period?: string;
  sourceUrl: string;
};

export async function fetchPermitDelays(limit?: number): Promise<PermitDelayRecord[]> {
  const cap = limit ?? getSyncLimit("permit-delays");
  const cfg = DATASETS["permit-delays"];

  const resourceUrl = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl, 2_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: PermitDelayRecord[] = [];

  for (const row of rows) {
    const borough = pick(row, "arrondissement", "borough", "ARRONDISSEMENT");
    if (!borough) continue;

    const phase = pick(row, "phase", "type_phase", "categorie");
    const period = pick(row, "periode", "trimestre", "period", "annee");
    const externalId = `${borough}-${phase || "all"}-${period || "recent"}`.slice(0, 120);

    results.push({
      externalId,
      borough,
      phase: phase || undefined,
      medianDays: parseFloatSafe(
        pick(row, "delai_median", "median_days", "delai_mediane", "delai")
      ),
      targetDays: parseFloatSafe(
        pick(row, "delai_cible", "target_days", "objectif", "delai_objectif")
      ),
      period: period || undefined,
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results;
}
