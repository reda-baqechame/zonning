import { fetchJson } from "../client";
import { DATASETS, getSyncLimit, type DatasetId } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";
import { arcGisFeature } from "../adapters/ArcGisFeatureAdapter";
import type { Pum2050ZoningRecord } from "./pum2050-zoning";

type GeoCollection = { features?: { properties?: Record<string, unknown>; geometry?: unknown }[] };

async function fetchZoningFromDirectUrl(
  url: string,
  city: string,
  idPrefix: string,
  cap: number,
  sourceUrl: string
): Promise<Pum2050ZoningRecord[]> {
  if (url.includes("FeatureServer") || url.includes("MapServer")) {
    const records = await arcGisFeature.queryAll(
      url,
      (attrs, centroid, i) => ({
        externalId: `${idPrefix}-${pickProp(attrs, "objectid", "id", "fid") || i}`,
        city,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        landUse: pickProp(attrs, "affectation", "usage", "zone", "descriptio") || undefined,
        zoneCode: pickProp(attrs, "code_zone", "code", "zone", "zonage") || undefined,
        description: pickProp(attrs, "description", "zone") || `Zonage ${city}`,
        sourceUrl,
      }),
      { maxRecords: cap, returnGeometry: true, outFields: "*" }
    );
    return records;
  }

  const data = await fetchJson<GeoCollection>(url);
  if (data?.features?.length) {
    return mapGeoFeatures(
      data.features as Parameters<typeof mapGeoFeatures>[0],
      (props, lat, lng, i) => ({
        externalId: `${idPrefix}-${pickProp(props, "id", "objectid") || i}`,
        city,
        latitude: lat,
        longitude: lng,
        landUse: pickProp(props, "affectation", "usage", "zone") || undefined,
        zoneCode: pickProp(props, "code_zone", "code", "zone", "zonage") || undefined,
        description: pickProp(props, "description", "zone") || `Zonage ${city}`,
        sourceUrl,
      }),
      cap
    );
  }
  return [];
}

async function fetchRegionalZoning(
  datasetId: DatasetId,
  city: string,
  idPrefix: string,
  envUrlKey: string,
  limit?: number
): Promise<Pum2050ZoningRecord[]> {
  const cap = limit ?? getSyncLimit(datasetId);
  const cfg = DATASETS[datasetId];
  const envUrl = process.env[envUrlKey];
  if (envUrl) {
    const fromEnv = await fetchZoningFromDirectUrl(envUrl, city, idPrefix, cap, cfg.sourceUrl);
    if (fromEnv.length > 0) return fromEnv;
  }
  if (cfg.arcGisLayerUrl) {
    const fromArc = await fetchZoningFromDirectUrl(
      cfg.arcGisLayerUrl,
      city,
      idPrefix,
      cap,
      cfg.sourceUrl
    );
    if (fromArc.length > 0) return fromArc;
  }
  const features = await fetchDatasetGeoJson(datasetId, cap);
  return mapGeoFeatures(
    features,
    (props, lat, lng, i) => ({
      externalId: `${idPrefix}-${pickProp(props, "id", "objectid") || i}`,
      city,
      latitude: lat,
      longitude: lng,
      landUse: pickProp(props, "affectation", "usage", "zone") || undefined,
      zoneCode: pickProp(props, "code", "zone", "zonage") || undefined,
      description: `Zonage ${city}`,
      sourceUrl: cfg.sourceUrl,
    }),
    cap
  );
}

export async function fetchZoningTroisRivieres(
  limit?: number
): Promise<Pum2050ZoningRecord[]> {
  const cap = limit ?? getSyncLimit("zoning-trois-rivieres");
  const cfg = DATASETS["zoning-trois-rivieres"];
  const features = await fetchDatasetGeoJson("zoning-trois-rivieres", cap);

  return mapGeoFeatures(
    features,
    (props, lat, lng, i) => ({
      externalId: `v3r-zoning-${pickProp(props, "id", "objectid", "zone") || i}`,
      city: "Trois-Rivières",
      borough: pickProp(props, "secteur", "quartier") || undefined,
      latitude: lat,
      longitude: lng,
      landUse: pickProp(props, "affectation", "usage", "zone") || undefined,
      zoneCode: pickProp(props, "code_zone", "zone", "zonage") || undefined,
      description: pickProp(props, "description", "zone") || "Zonage V3R",
      sourceUrl: cfg.sourceUrl,
    }),
    cap
  );
}

export async function fetchZoningSherbrooke(
  limit?: number
): Promise<Pum2050ZoningRecord[]> {
  return fetchRegionalZoning("zoning-sherbrooke", "Sherbrooke", "sherbrooke-zoning", "SHERBROOKE_ZONING_URL", limit);
}

export async function fetchZoningQuebec(
  limit?: number
): Promise<Pum2050ZoningRecord[]> {
  return fetchRegionalZoning("zoning-quebec", "Québec", "quebec-zoning", "QUEBEC_ZONING_URL", limit);
}

export async function fetchZoningLaval(limit?: number): Promise<Pum2050ZoningRecord[]> {
  return fetchRegionalZoning("zoning-laval", "Laval", "laval-zoning", "LAVAL_ZONING_URL", limit);
}

export async function fetchZoningLongueuil(limit?: number): Promise<Pum2050ZoningRecord[]> {
  return fetchRegionalZoning(
    "zoning-longueuil",
    "Longueuil",
    "longueuil-zoning",
    "LONGUEUIL_ZONING_URL",
    limit
  );
}
