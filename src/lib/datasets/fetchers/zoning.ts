import { fetchCkanResourceUrl, fetchJson } from "../client";
import { DATASETS } from "../registry";

export type ZoningRecord = {
  borough: string;
  densityZone: string;
  maxFloors?: number;
  description?: string;
  sourceUrl: string;
};

type GeoFeature = {
  properties?: Record<string, string | number>;
};

type GeoCollection = { features?: GeoFeature[] };

const BOROUGH_KEYS = [
  "arrondissement",
  "nom_arrondissement",
  "borough",
  "municipalite",
  "nom_mun",
];

const ZONE_KEYS = [
  "code_zone",
  "zone",
  "affectation",
  "densite",
  "schema",
  "grd_cor",
  "grdcor",
];

const FLOOR_KEYS = ["etages_max", "hauteur_max", "max_etages", "nb_etages"];

export async function fetchZoningByBorough(): Promise<ZoningRecord[]> {
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.zoning.ckanId,
    DATASETS.zoning.preferredFormat
  );
  if (!resourceUrl) {
    console.error("[zoning] CKAN resource URL not found — refusing synthetic fallback");
    return [];
  }

  const data = await fetchJson<GeoCollection>(resourceUrl);
  if (!data?.features?.length) {
    console.error("[zoning] GeoJSON has no features — refusing synthetic fallback");
    return [];
  }

  const byBorough = new Map<string, { zones: Set<string>; maxFloors?: number }>();

  for (const feature of data.features.slice(0, 5000)) {
    const props = feature.properties ?? {};
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(props)) {
      normalized[k.toLowerCase()] = String(v);
    }

    let borough = "";
    for (const k of BOROUGH_KEYS) {
      if (normalized[k]) {
        borough = normalized[k];
        break;
      }
    }
    if (!borough) continue;

    let zone = "";
    for (const k of ZONE_KEYS) {
      if (normalized[k]) {
        zone = normalized[k];
        break;
      }
    }

    const floors = FLOOR_KEYS.map((k) => parseInt(normalized[k] ?? "", 10)).find(
      (n) => Number.isFinite(n) && n > 0
    );

    const entry = byBorough.get(borough) ?? { zones: new Set<string>() };
    if (zone) entry.zones.add(zone);
    if (floors && (!entry.maxFloors || floors > entry.maxFloors)) {
      entry.maxFloors = floors;
    }
    byBorough.set(borough, entry);
  }

  if (byBorough.size === 0) {
    console.error("[zoning] No borough zones parsed — refusing synthetic fallback");
    return [];
  }

  return Array.from(byBorough.entries()).map(([borough, info]) => ({
    borough,
    densityZone: Array.from(info.zones).slice(0, 3).join(", ") || "Mixte",
    maxFloors: info.maxFloors,
    description: `Zone(s) PUM: ${Array.from(info.zones).slice(0, 2).join(" / ") || "voir schéma municipal"}`,
    sourceUrl: DATASETS.zoning.sourceUrl,
  }));
}
