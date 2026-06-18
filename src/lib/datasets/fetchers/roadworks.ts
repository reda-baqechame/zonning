import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseDate, parseFloatSafe } from "../parser";

export type RoadWorkRecord = {
  externalId: string;
  title?: string;
  description?: string;
  borough?: string;
  city?: string;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  latitude?: number;
  longitude?: number;
  sourceUrl: string;
};

export async function fetchRoadWorks(limit?: number): Promise<RoadWorkRecord[]> {
  const cap = limit ?? getSyncLimit("roadworks");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.roadworks.ckanId,
    DATASETS.roadworks.preferredFormat
  );
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl, 10_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: RoadWorkRecord[] = [];

  for (const row of rows) {
    const title = pick(
      row,
      "titre",
      "title",
      "nom",
      "type_travaux",
      "nature_travaux",
      "description_courte"
    );
    const desc = pick(row, "description", "details", "impact", "impacts");
    const id = pick(row, "id", "identifiant", "no_chantier", "OBJECTID") || `rw-${results.length}`;

    results.push({
      externalId: id,
      title: title || undefined,
      description: desc || undefined,
      borough: pick(row, "arrondissement", "borough", "secteur"),
      city: "Montréal",
      startDate: parseDate(pick(row, "date_debut", "debut", "start_date", "date_start")),
      endDate: parseDate(pick(row, "date_fin", "fin", "end_date", "date_end")),
      status: pick(row, "statut", "status", "etat"),
      latitude: parseFloatSafe(pick(row, "latitude", "lat", "y")),
      longitude: parseFloatSafe(pick(row, "longitude", "long", "x")),
      sourceUrl: DATASETS.roadworks.sourceUrl,
    });
  }

  return results;
}
