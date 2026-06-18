import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseFloatSafe } from "../parser";

export type CommercialRecord = {
  externalId: string;
  address?: string;
  borough?: string;
  latitude?: number;
  longitude?: number;
  vacancyType?: string;
  areaSqm?: number;
  sourceUrl: string;
};

export async function fetchCommercialVacancies(limit?: number): Promise<CommercialRecord[]> {
  const cap = limit ?? getSyncLimit("commercial");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.commercial.ckanId,
    DATASETS.commercial.preferredFormat
  );
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: CommercialRecord[] = [];

  for (const row of rows) {
    const externalId = pick(row, "id", "no_local") || `commercial-${results.length}`;
    const civic = pick(row, "no_civique", "nocivique");
    const street = pick(row, "nom_rue", "rue");

    results.push({
      externalId,
      address: pick(row, "adresse") || `${civic} ${street}`.trim() || undefined,
      borough: pick(row, "arrondissement", "borough"),
      latitude: parseFloatSafe(pick(row, "latitude", "lat", "y")),
      longitude: parseFloatSafe(pick(row, "longitude", "long", "lon", "x")),
      vacancyType: pick(row, "type", "statut", "usage"),
      areaSqm: parseFloatSafe(pick(row, "superficie", "aire", "superficie_m2")),
      sourceUrl: DATASETS.commercial.sourceUrl,
    });
  }

  return results;
}
