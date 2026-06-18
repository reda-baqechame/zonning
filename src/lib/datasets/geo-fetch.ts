import { fetchCkanResourceUrl, fetchJson } from "./client";
import { montrealCkan } from "./adapters/MontrealCkanAdapter";
import { parseGeoJsonCentroids, type GeoFeatureWithProps } from "./geo";
import type { DatasetId } from "./registry";
import { DATASETS } from "./registry";

type GeoCollection = { features?: GeoFeatureWithProps[] };

export async function fetchDatasetGeoJson(
  datasetId: DatasetId,
  maxFeatures = 8000
): Promise<GeoFeatureWithProps[]> {
  const cfg = DATASETS[datasetId];
  const host = cfg.ckanHost ?? "quebec";

  const resourceUrl =
    cfg.directResourceUrl ??
    (host === "montreal"
      ? await montrealCkan.getResourceUrl(cfg.ckanId, cfg.preferredFormat)
      : await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat, host));

  if (!resourceUrl) return [];

  const data = await fetchJson<GeoCollection>(resourceUrl);
  return (data?.features ?? []).slice(0, maxFeatures);
}

export function mapGeoFeatures<T extends Record<string, unknown>>(
  features: GeoFeatureWithProps[],
  mapper: (props: Record<string, unknown>, lat: number, lng: number, i: number) => T | null,
  cap?: number
): T[] {
  return parseGeoJsonCentroids(
    features,
    (props, centroid, i) => mapper(props, centroid.latitude, centroid.longitude, i),
    cap ?? 8000
  );
}

export function pickProp(props: Record<string, unknown>, ...keys: string[]): string {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    normalized[k.toLowerCase()] = String(v ?? "");
  }
  for (const key of keys) {
    const val = normalized[key.toLowerCase()];
    if (val) return val;
  }
  return "";
}
