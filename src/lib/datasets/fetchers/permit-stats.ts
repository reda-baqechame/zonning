import { fetchCkanResourceUrl, fetchText, findResourceUrl } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseMoney, parseIntSafe } from "../parser";

export type BoroughStatRecord = {
  externalId: string;
  borough: string;
  permitType?: string;
  period?: string;
  permitCount?: number;
  estimatedCost?: number;
  permitCost?: number;
  sourceUrl: string;
};

export async function fetchPermitStats(limit?: number): Promise<BoroughStatRecord[]> {
  const cap = limit ?? getSyncLimit("permit-stats");
  const url =
    (await findResourceUrl("vmtl-permis-construction", "statistiques", "CSV")) ??
    (await fetchCkanResourceUrl("vmtl-permis-construction", "CSV"));

  if (!url) return [];

  const text = await fetchText(url, 5_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: BoroughStatRecord[] = [];

  for (const row of rows) {
    const borough = pick(row, "arrondissement", "borough", "ARRONDISSEMENT");
    const permitType = pick(
      row,
      "code_type_base_demande",
      "type_demande",
      "type_permis",
      "description_type"
    );
    if (!borough && !permitType) continue;

    const period = pick(row, "annee", "year", "periode", "mois") || "recent";
    const externalId = `${borough}-${permitType}-${period}`.slice(0, 120);

    results.push({
      externalId,
      borough: borough || "Montréal",
      permitType: permitType || undefined,
      period,
      permitCount: parseIntSafe(
        pick(row, "nombre_permis_emis", "nb_permis", "count", "nombre")
      ),
      estimatedCost: parseMoney(
        pick(row, "cout_travaux_estimes", "cout_estime", "valeur_travaux")
      ),
      permitCost: parseMoney(pick(row, "cout_permis_emis", "cout_permis")),
      sourceUrl: DATASETS["permit-stats"].sourceUrl,
    });
  }

  return results;
}
