import { fetchCkanResourceUrl, fetchText, fetchCkanPackage, fetchCkanDatastoreSearch } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseFloatSafe } from "../parser";

export type HeritageRecord = {
  externalId: string;
  name?: string;
  address?: string;
  borough?: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  status?: string;
  description?: string;
  sourceUrl: string;
};

export type HeritagePageResult = {
  records: HeritageRecord[];
  fetched: number;
  complete: boolean;
};

function findHeritageResource(
  datasetId: "heritage" | "heritage-eip",
  resources: { id: string; format?: string; name?: string }[]
) {
  return resources.find(
    (r) =>
      r.format?.toUpperCase() === "CSV" &&
      (datasetId === "heritage-eip"
        ? r.name?.toLowerCase().includes("intérêt") ||
          r.name?.toLowerCase().includes("interet") ||
          r.name?.toLowerCase().includes("protection")
        : r.name?.toLowerCase().includes("patrimoniaux") ||
          r.name?.toLowerCase().includes("édifices") ||
          r.name?.toLowerCase().includes("edifices"))
  );
}

export async function fetchHeritageSitesPage(
  datasetId: "heritage" | "heritage-eip",
  offset: number,
  batchSize: number
): Promise<HeritagePageResult> {
  const cfg = DATASETS[datasetId];
  const pkg = await fetchCkanPackage(cfg.ckanId);
  const csvResource = pkg ? findHeritageResource(datasetId, pkg.resources) : undefined;

  if (csvResource?.id) {
    const page = Math.min(500, batchSize);
    const records: HeritageRecord[] = [];
    let fetched = 0;
    let cursor = offset;

    while (records.length < batchSize) {
      const rows = await fetchCkanDatastoreSearch(csvResource.id, page, cursor);
      if (rows.length === 0) {
        return { records, fetched, complete: true };
      }

      for (const raw of rows) {
        const row = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v ?? "")])
        );
        const record = mapHeritageRow(row, datasetId, cfg.sourceUrl);
        if (record) records.push(record);
        if (records.length >= batchSize) break;
      }

      fetched += rows.length;
      cursor += rows.length;
      if (rows.length < page) {
        return { records, fetched, complete: true };
      }
    }

    return { records, fetched, complete: false };
  }

  const all = await fetchHeritageSites(datasetId, offset + batchSize);
  const records = all.slice(offset, offset + batchSize);
  return {
    records,
    fetched: records.length,
    complete: records.length < batchSize,
  };
}

export async function fetchHeritageSites(
  datasetId: "heritage" | "heritage-eip",
  limit?: number
): Promise<HeritageRecord[]> {
  const cfg = DATASETS[datasetId];
  const cap = limit ?? getSyncLimit(datasetId);
  const pkg = await fetchCkanPackage(cfg.ckanId);

  const csvResource = pkg?.resources.find(
    (r) =>
      r.format?.toUpperCase() === "CSV" &&
      (datasetId === "heritage-eip"
        ? r.name?.toLowerCase().includes("intérêt") ||
          r.name?.toLowerCase().includes("interet") ||
          r.name?.toLowerCase().includes("protection")
        : r.name?.toLowerCase().includes("patrimoniaux") ||
          r.name?.toLowerCase().includes("édifices") ||
          r.name?.toLowerCase().includes("edifices"))
  );

  if (csvResource?.id) {
    const results: HeritageRecord[] = [];
    let offset = 0;
    const page = Math.min(500, cap);

    while (results.length < cap) {
      const records = await fetchCkanDatastoreSearch(csvResource.id, page, offset);
      if (records.length === 0) break;

      for (const raw of records) {
        const row = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v ?? "")])
        );
        const record = mapHeritageRow(row, datasetId, cfg.sourceUrl);
        if (record) results.push(record);
        if (results.length >= cap) break;
      }

      offset += records.length;
      if (records.length < page) break;
    }

    if (results.length > 0) return results;
  }

  const resourceUrl = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl, 10_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: HeritageRecord[] = [];

  for (const row of rows) {
    const record = mapHeritageRow(row, datasetId, cfg.sourceUrl);
    if (record) results.push(record);
  }

  return results;
}

function mapHeritageRow(
  row: Record<string, string>,
  datasetId: "heritage" | "heritage-eip",
  sourceUrl: string
): HeritageRecord | null {
  const name = pick(
    row,
    "nom_historique",
    "nom",
    "name",
    "denomination",
    "nom_batiment"
  );
  const civic = pick(row, "civique", "civique_min", "no_civique");
  const street = pick(row, "voie", "nom_rue", "rue");
  const address =
    pick(row, "adresse", "address", "emplacement") ||
    `${civic}${street ? ` ${street}` : ""}`.trim();
  if (!name && !address) return null;

  const externalId =
    pick(row, "identifiant_batiment", "id", "identifiant", "no_batiment") ||
    `${datasetId}-${name.slice(0, 24)}`;

  const centroX = parseFloatSafe(pick(row, "centro_x", "longitude", "long"));
  const centroY = parseFloatSafe(pick(row, "centro_y", "latitude", "lat"));

  return {
    externalId: `${datasetId}-${externalId}`,
    name: name || undefined,
    address: address || undefined,
    borough: pick(row, "arrondissement", "borough")?.replace(/\s*\(Montréal\)\s*/i, ""),
    latitude: centroY ?? parseFloatSafe(pick(row, "latitude", "lat")),
    longitude: centroX ?? parseFloatSafe(pick(row, "longitude", "long", "lon")),
    category: pick(row, "typologie_specifique", "categorie", "category", "type"),
    status: pick(row, "statut", "status", "protection"),
    description: pick(row, "historique_sommaire", "description", "valeur_patrimoniale"),
    sourceUrl,
  };
}
