import { fetchCkanResourceUrl, fetchJson } from "./client";
import { montrealCkan } from "./adapters/MontrealCkanAdapter";
import { parseGeoJsonCentroids, type GeoFeatureWithProps } from "./geo";
import type { DatasetId } from "./registry";
import { DATASETS } from "./registry";
import proj4 from "proj4";

type GeoCollection = {
  features?: GeoFeatureWithProps[];
  crs?: { properties?: { name?: string } };
};

proj4.defs(
  "EPSG:32188",
  "+proj=tmerc +lat_0=0 +lon_0=-73.5 +k=0.9999 +x_0=304800 +y_0=0 +datum=NAD83 +units=m +no_defs",
);
proj4.defs(
  "EPSG:2950",
  "+proj=tmerc +lat_0=0 +lon_0=-73.5 +k=0.9999 +x_0=304800 +y_0=0 +ellps=GRS80 +units=m +no_defs",
);

function transformCoordinates(value: unknown, sourceCrs: "EPSG:32188" | "EPSG:2950"): unknown {
  if (!Array.isArray(value)) return value;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return proj4(sourceCrs, "EPSG:4326", [value[0], value[1]]);
  }
  return value.map((child) => transformCoordinates(child, sourceCrs));
}

export function reprojectGeoJsonFeatures(
  features: GeoFeatureWithProps[],
  crsName?: string,
): GeoFeatureWithProps[] {
  const sourceCrs = crsName?.includes("32188")
    ? "EPSG:32188"
    : crsName?.includes("2950")
      ? "EPSG:2950"
      : null;
  if (!sourceCrs) return features;
  return features.map((feature) => ({
    ...feature,
    geometry: feature.geometry
      ? {
          ...feature.geometry,
          coordinates: transformCoordinates(feature.geometry.coordinates, sourceCrs) as NonNullable<
            GeoFeatureWithProps["geometry"]
          >["coordinates"],
        }
      : undefined,
  }));
}

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

  let data = await fetchJson<GeoCollection>(resourceUrl);
  if (
    (!data?.features || data.features.length === 0) &&
    cfg.directResourceUrl &&
    resourceUrl === cfg.directResourceUrl
  ) {
    await new Promise((r) => setTimeout(r, 8_000));
    data = await fetchJson<GeoCollection>(resourceUrl);
  }
  const features = (data?.features ?? []).slice(0, maxFeatures);
  return reprojectGeoJsonFeatures(features, data?.crs?.properties?.name);
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
