import { fetchJson } from "../client";
import { DATASETS, getSyncLimit, type DatasetId } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";
import { arcGisFeature } from "../adapters/ArcGisFeatureAdapter";
import type { Pum2050ZoningRecord } from "./pum2050-zoning";
import { buildZoningExternalId } from "@/lib/zoning/record-quality";

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
      (attrs, centroid) => {
        const record = {
          city,
          latitude: centroid.latitude,
          longitude: centroid.longitude,
          landUse:
            pickProp(attrs, "affectation", "usage", "groupeusage", "v_description", "descriptio") ||
            undefined,
          zoneCode:
            pickProp(attrs, "code_zone", "code", "zone", "zonage", "zonagemunicipalid", "no_zone", "id") ||
            undefined,
          sourceUrl,
        };
        const externalId = buildZoningExternalId(
          idPrefix,
          pickProp(attrs, "objectid", "id", "fid", "uuid"),
          record,
        );
        return externalId
          ? {
              externalId,
              ...record,
              description:
                pickProp(attrs, "description", "v_description", "zone") || `Zonage ${city}`,
            }
          : null;
      },
      { maxRecords: cap, returnGeometry: true, outFields: "*" }
    );
    return records;
  }

  const data = await fetchJson<GeoCollection>(url);
  if (data?.features?.length) {
    return mapGeoFeatures(
      data.features as Parameters<typeof mapGeoFeatures>[0],
      (props, lat, lng) => {
        const record = {
          city,
          latitude: lat,
          longitude: lng,
          landUse:
            pickProp(props, "affectation", "usage", "groupeusage", "v_description") || undefined,
          zoneCode:
            pickProp(props, "code_zone", "code", "zone", "zonage", "zonagemunicipalid", "no_zone", "id") ||
            undefined,
          sourceUrl,
        };
        const externalId = buildZoningExternalId(
          idPrefix,
          pickProp(props, "id", "objectid", "fid", "uuid"),
          record,
        );
        return externalId
          ? {
              externalId,
              ...record,
              description:
                pickProp(props, "description", "v_description", "zone") || `Zonage ${city}`,
            }
          : null;
      },
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
    (props, lat, lng) => {
      const record = {
        city,
        latitude: lat,
        longitude: lng,
        landUse:
          pickProp(props, "affectation", "usage", "groupeusage", "v_description") || undefined,
        zoneCode:
          pickProp(props, "code_zone", "code", "zone", "zonage", "zonagemunicipalid", "no_zone", "id") ||
          undefined,
        sourceUrl: cfg.sourceUrl,
      };
      const externalId = buildZoningExternalId(
        idPrefix,
        pickProp(props, "id", "objectid", "fid", "uuid", "no_zone"),
        record,
      );
      return externalId ? { externalId, ...record, description: `Zonage ${city}` } : null;
    },
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
    (props, lat, lng) => {
      const status = pickProp(props, "statut", "status").toLowerCase();
      if (status && !status.includes("en vigueur") && !status.includes("active")) return null;
      const record = {
        city: "Trois-Rivières",
        latitude: lat,
        longitude: lng,
        landUse:
          pickProp(props, "v_description", "groupeusage", "affectation", "usage") || undefined,
        zoneCode:
          pickProp(props, "zonagemunicipalid", "no_zone", "code_zone", "zone", "zonage") ||
          undefined,
        sourceUrl: cfg.sourceUrl,
      };
      const externalId = buildZoningExternalId(
        "zoning-trois-rivieres",
        pickProp(props, "id", "objectid", "fid", "uuid"),
        record,
      );
      return externalId
        ? {
            externalId,
            ...record,
            borough: pickProp(props, "secteur", "quartier") || undefined,
            description:
              pickProp(props, "v_description", "description", "zone") || "Zonage V3R",
          }
        : null;
    },
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
