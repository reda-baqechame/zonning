import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseMoney, parseDate } from "../parser";

export type TransactionRecord = {
  externalId: string;
  matricule?: string;
  address?: string;
  borough?: string;
  salePrice?: number;
  saleDate?: Date;
  buildingType?: string;
  sourceUrl: string;
};

export async function fetchTransactions(
  limit?: number,
  datasetId: "transactions" | "transactions-2023" | "transactions-2025" = "transactions"
): Promise<TransactionRecord[]> {
  const cap = limit ?? getSyncLimit(datasetId);
  const cfg = DATASETS[datasetId];
  const resourceUrl = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: TransactionRecord[] = [];

  for (const row of rows) {
    const externalId =
      pick(row, "id", "no_transaction", "numero") || `txn-${results.length}`;
    const civic = pick(row, "no_civique_debut", "nociviquedebut", "no_civique");
    const street = pick(row, "nom_rue", "rue");

    results.push({
      externalId,
      matricule: pick(row, "matricule", "idu") || undefined,
      address: pick(row, "adresse") || `${civic} ${street}`.trim() || undefined,
      borough: pick(row, "arrondissement", "borough"),
      salePrice: parseMoney(
        pick(row, "prix_vente", "montant", "valeur", "prix")
      ),
      saleDate: parseDate(
        pick(row, "date_mutation", "date_transaction", "date_vente", "date")
      ),
      buildingType: pick(row, "type_batiment", "categorie", "usage"),
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results;
}
