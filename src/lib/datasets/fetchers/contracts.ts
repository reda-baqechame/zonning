import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit, type DatasetId } from "../registry";
import { parseCsvText, pick, parseMoney, parseDate } from "../parser";

export type ContractRecord = {
  externalId: string;
  supplierName?: string;
  description?: string;
  amount?: number;
  service?: string;
  borough?: string;
  approvedAt?: Date;
  contractNumber?: string;
  sourceUrl: string;
};

export async function fetchMunicipalContractsForDataset(
  datasetId: DatasetId = "contracts"
): Promise<ContractRecord[]> {
  const cfg = DATASETS[datasetId];
  const cap = getSyncLimit(datasetId);
  const resourceUrl = await fetchCkanResourceUrl(
    cfg.ckanId,
    cfg.preferredFormat,
    cfg.ckanHost ?? "quebec"
  );
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl, 15_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: ContractRecord[] = [];

  for (const row of rows) {
    const supplier = pick(row, "fournisseur", "FOURNISSEUR", "supplier", "nom_fournisseur");
    const desc = pick(row, "description", "DESCRIPTION", "activite", "ACTIVITÉ", "objet");
    const amount = parseMoney(pick(row, "montant", "MONTANT", "amount", "valeur"));
    if (!supplier && !desc) continue;

    const num = pick(row, "numero", "NUMÉRO", "no_contrat", "id");
    const externalId =
      datasetId === "contracts" ? num || `contract-${results.length}` : `${datasetId}-${num || results.length}`;

    results.push({
      externalId,
      supplierName: supplier || undefined,
      description: desc || undefined,
      amount: amount ?? undefined,
      service: pick(row, "service", "SERVICE", "departement"),
      borough: pick(row, "arrondissement", "borough"),
      approvedAt: parseDate(
        pick(row, "date d'approbation", "date_approbation", "DATE D'APPROBATION", "date")
      ),
      contractNumber: num || undefined,
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results;
}

export async function fetchMunicipalContracts(limit?: number): Promise<ContractRecord[]> {
  const cap = limit ?? getSyncLimit("contracts");
  const all = await fetchMunicipalContractsForDataset("contracts");
  return all.slice(0, cap);
}
