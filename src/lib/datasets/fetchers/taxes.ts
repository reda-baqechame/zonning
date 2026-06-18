import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseMoney, parseIntSafe } from "../parser";

export type TaxRecord = {
  externalId: string;
  matricule?: string;
  borough?: string;
  taxAmount?: number;
  year?: number;
  sourceUrl: string;
};

export async function fetchPropertyTaxes(limit?: number): Promise<TaxRecord[]> {
  const cap = limit ?? getSyncLimit("taxes");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.taxes.ckanId,
    DATASETS.taxes.preferredFormat
  );
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: TaxRecord[] = [];

  for (const row of rows) {
    const matricule = pick(row, "matricule", "idu");
    const externalId =
      `${matricule || "tax"}-${pick(row, "annee", "year") || results.length}`;

    results.push({
      externalId,
      matricule: matricule || undefined,
      borough: pick(row, "arrondissement", "borough"),
      taxAmount: parseMoney(
        pick(row, "montant_taxe", "taxe_totale", "montant", "taxe")
      ),
      year: parseIntSafe(pick(row, "annee", "year", "annee_fiscale")),
      sourceUrl: DATASETS.taxes.sourceUrl,
    });
  }

  return results;
}
