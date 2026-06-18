import { fetchText } from "../client";
import { arcGisFeature } from "../adapters/ArcGisFeatureAdapter";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick, parseFloatSafe, parseIntSafe } from "../parser";

export type DevelopmentProjectRecord = {
  externalId: string;
  name?: string;
  city: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  unitsPlanned?: number;
  projectUrl?: string;
  sourceUrl: string;
};

export async function fetchSherbrookeProjects(
  limit?: number
): Promise<DevelopmentProjectRecord[]> {
  const cap = limit ?? getSyncLimit("projects-sherbrooke");
  const cfg = DATASETS["projects-sherbrooke"];
  const layerUrl = cfg.arcGisLayerUrl;
  if (!layerUrl) return [];

  return arcGisFeature.queryAll(
    layerUrl,
    (attrs, centroid, i) => {
      const name = String(attrs.NOM ?? attrs.nom ?? attrs.Name ?? "").trim();
      const units = attrs.NOMBREUNITE ?? attrs.nombreunite;
      const url = String(attrs.HYPERLIEN ?? attrs.hyperlien ?? "").trim();
      return {
        externalId: `sherbrooke-project-${attrs.OBJECTID ?? attrs.objectid ?? i}`,
        name: name || undefined,
        city: "Sherbrooke",
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        unitsPlanned:
          typeof units === "number"
            ? units
            : parseInt(String(units ?? ""), 10) || undefined,
        projectUrl: url || undefined,
        sourceUrl: cfg.sourceUrl,
      };
    },
    { maxRecords: cap }
  );
}

export async function fetchBrossardProjects(
  limit?: number
): Promise<DevelopmentProjectRecord[]> {
  const url = process.env.BROSSARD_PROJECTS_URL;
  if (!url) return [];

  const cap = limit ?? getSyncLimit("projects-brossard");
  const cfg = DATASETS["projects-brossard"];
  const text = await fetchText(url, 10_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap);
  const results: DevelopmentProjectRecord[] = [];

  for (const row of rows) {
    const name = pick(row, "nom", "name", "projet", "description", "titre");
    const lat = parseFloatSafe(pick(row, "latitude", "lat", "y"));
    const lng = parseFloatSafe(pick(row, "longitude", "lng", "lon", "x"));
    if (!name && lat == null) continue;

    results.push({
      externalId: `brossard-${pick(row, "id", "numero", "no_projet") || results.length}`,
      name: name || undefined,
      city: "Brossard",
      address: pick(row, "adresse", "address", "emplacement") || undefined,
      latitude: lat,
      longitude: lng,
      unitsPlanned: parseIntSafe(pick(row, "unites", "units", "nb_unites")),
      projectUrl: pick(row, "url", "lien", "hyperlien") || undefined,
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results.slice(0, cap);
}
