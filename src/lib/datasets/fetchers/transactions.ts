import { fetchCkanPackage, fetchCkanResourceUrl, fetchText } from "../client";
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

type TransactionDatasetId = "transactions" | "transactions-2023" | "transactions-2025";

function transactionYear(datasetId: TransactionDatasetId) {
  if (datasetId === "transactions-2023") return "2023";
  if (datasetId === "transactions-2025") return "2025";
  return "2024";
}

async function fetchTransactionResourceUrl(
  datasetId: TransactionDatasetId,
): Promise<string | null> {
  const cfg = DATASETS[datasetId];
  const year = transactionYear(datasetId);
  const pkg = await fetchCkanPackage(cfg.ckanId, cfg.ckanHost ?? "quebec");
  const match = pkg?.resources.find(
    (resource) =>
      (resource.format?.toUpperCase() === "CSV" ||
        resource.url?.toLowerCase().endsWith(".csv")) &&
      (resource.name?.includes(year) || resource.url?.includes(year)),
  );
  return match?.url ?? fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat, cfg.ckanHost);
}

export function parseTransactionRows(
  rows: Record<string, string>[],
  datasetId: TransactionDatasetId,
): TransactionRecord[] {
  const cfg = DATASETS[datasetId];
  const results: TransactionRecord[] = [];

  for (const row of rows) {
    const externalId =
      pick(
        row,
        "id",
        "no_transaction",
        "numero",
        "num\u00e9ro de d\u00e9cision/r\u00e9solution",
        "numero de decision/resolution",
        "num\u00e9ro acte notari\u00e9",
        "numero acte notarie",
      ) || `txn-${results.length}`;
    const civic = pick(row, "no_civique_debut", "nociviquedebut", "no_civique");
    const street = pick(row, "nom_rue", "rue");

    results.push({
      externalId,
      matricule: pick(row, "matricule", "idu") || undefined,
      address: pick(row, "adresse") || `${civic} ${street}`.trim() || undefined,
      borough: pick(row, "arrondissement", "borough"),
      salePrice: parseMoney(
        pick(row, "prix_vente", "montant", "valeur", "prix", "montant de la transaction")
      ),
      saleDate: parseDate(
        pick(row, "date_mutation", "date_transaction", "date_vente", "date")
      ),
      buildingType: pick(row, "type_batiment", "categorie", "cat\u00e9gorie", "usage"),
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results;
}

export async function fetchTransactions(
  limit?: number,
  datasetId: TransactionDatasetId = "transactions"
): Promise<TransactionRecord[]> {
  const cap = limit ?? getSyncLimit(datasetId);
  const resourceUrl = await fetchTransactionResourceUrl(datasetId);
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  return parseTransactionRows(rows, datasetId);
}
