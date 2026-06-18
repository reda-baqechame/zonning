import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick } from "../parser";

export type SupplierRecord = {
  externalId: string;
  supplierNumber?: string;
  name: string;
  neq?: string;
  borough?: string;
  address?: string;
  phone?: string;
  sourceUrl: string;
};

export async function fetchSuppliers(
  limit?: number
): Promise<SupplierRecord[]> {
  const cap = limit ?? getSyncLimit("suppliers");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.suppliers.ckanId,
    DATASETS.suppliers.preferredFormat
  );
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: SupplierRecord[] = [];

  for (const row of rows) {
    const name = pick(row, "nom_fournisseur", "nom", "name", "raison_sociale");
    if (!name) continue;

    const supplierNumber = pick(row, "numero_fournisseur", "no_fournisseur");
    const externalId = supplierNumber || `supplier-${results.length}`;

    results.push({
      externalId,
      supplierNumber: supplierNumber || undefined,
      name,
      neq: pick(row, "num_entreprise_quebec", "neq", "numero_neq") || undefined,
      borough: pick(row, "lieu_arrondissement", "arrondissement", "borough"),
      address: pick(row, "adresse", "adresse_postale"),
      phone: pick(row, "telephone", "tel"),
      sourceUrl: DATASETS.suppliers.sourceUrl,
    });
  }

  return results;
}
