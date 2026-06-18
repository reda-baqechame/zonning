import { fetchCkanResourceUrl, fetchJson } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { pick, parseFloatSafe } from "../parser";

export type ContaminationRecord = {
  externalId: string;
  address?: string;
  borough?: string;
  region?: string;
  sourceLayer?: string;
  latitude?: number;
  longitude?: number;
  status?: string;
  description?: string;
  sourceUrl: string;
};

type ContaminatedRow = Record<string, unknown>;

export async function fetchContamination(limit?: number): Promise<ContaminationRecord[]> {
  const cap = limit ?? getSyncLimit("contamination");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.contamination.ckanId,
    DATASETS.contamination.preferredFormat
  );
  if (!resourceUrl) return [];

  const data = await fetchJson<ContaminatedRow[] | { data?: ContaminatedRow[] }>(
    resourceUrl
  );
  if (!data) return [];

  const rows = Array.isArray(data) ? data : (data.data ?? []);
  const results: ContaminationRecord[] = [];

  for (const row of rows) {
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      normalized[k.toLowerCase()] = String(v ?? "");
    }

    const externalId =
      pick(normalized, "id", "no_site", "nosite", "code") ||
      `contam-${results.length}`;

    const lat = parseFloatSafe(
      pick(normalized, "latitude", "lat", "y", "coord_y")
    );
    const lng = parseFloatSafe(
      pick(normalized, "longitude", "long", "lon", "x", "coord_x")
    );

    results.push({
      externalId,
      address:
        pick(normalized, "adresse", "adresse_site", "rue") || undefined,
      borough: pick(normalized, "arrondissement", "borough") || undefined,
      latitude: lat,
      longitude: lng,
      status: pick(normalized, "statut", "status", "etat") || undefined,
      description:
        pick(normalized, "description", "nom_site", "type_contamination") ||
        undefined,
      sourceUrl: DATASETS.contamination.sourceUrl,
    });

    if (results.length >= cap) break;
  }

  return results;
}
