import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseFloatSafe, parseDate } from "../parser";
import type { RoadWorkRecord } from "./roadworks";

export async function fetchRoadworksSaguenay(limit?: number): Promise<RoadWorkRecord[]> {
  const cap = limit ?? getSyncLimit("roadworks-saguenay");
  const cfg = DATASETS["roadworks-saguenay"];

  const resourceUrl = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
  if (!resourceUrl) return [];

  const text = await fetchText(resourceUrl, 5_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: RoadWorkRecord[] = [];

  for (const row of rows) {
    const externalId =
      pick(row, "id", "objectid", "no_chantier") || `saguenay-rw-${results.length}`;
    const lat = parseFloatSafe(pick(row, "latitude", "lat", "y"));
    const lng = parseFloatSafe(pick(row, "longitude", "long", "lon", "x"));

    results.push({
      externalId: `roadworks-saguenay-${externalId}`,
      title: pick(row, "titre", "title", "nom", "description") || undefined,
      description: pick(row, "description", "details") || undefined,
      borough: pick(row, "secteur", "quartier") || undefined,
      city: "Saguenay",
      startDate: parseDate(pick(row, "date_debut", "debut", "start_date")),
      endDate: parseDate(pick(row, "date_fin", "fin", "end_date")),
      status: pick(row, "statut", "status") || undefined,
      latitude: lat,
      longitude: lng,
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results;
}
