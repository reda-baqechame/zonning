import { fetchCkanResourceUrl } from "../client";
import { arcGisFeature } from "../adapters/ArcGisFeatureAdapter";
import { DATASETS, getSyncLimit } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";
import type { ContaminationRecord } from "./contamination";

const GTC_POINT_LAYER =
  "https://www.servicesgeo.enviroweb.gouv.qc.ca/donnees/rest/services/Public/Themes_publics/MapServer/12";

export async function fetchContaminationGtcFromArcGis(
  limit?: number
): Promise<ContaminationRecord[]> {
  const cap = limit ?? getSyncLimit("contamination-gtc");
  const cfg = DATASETS["contamination-gtc"];

  return arcGisFeature.queryAll(
    cfg.directResourceUrl ?? GTC_POINT_LAYER,
    (attrs, centroid, i) => {
      const lat = Number(attrs.LATITUDE ?? attrs.latitude) || centroid.latitude;
      const lng = Number(attrs.LONGITUDE ?? attrs.longitude) || centroid.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const siteId = String(attrs.NO_MEF_LIEU ?? attrs.OBJECTID ?? i);
      const regionRaw = String(attrs.LST_MRC_REG_ADM ?? "").trim();

      return {
        externalId: `gtc-${siteId}`,
        address: String(attrs.ADR_CIV_LIEU ?? "").trim() || undefined,
        borough: String(attrs.MUNICIPALITE ?? attrs.municipalite ?? "").trim() || undefined,
        latitude: lat,
        longitude: lng,
        status: String(attrs.DESC_MILIEU_RECEPT ?? attrs.STATUT ?? "").trim() || undefined,
        description: regionRaw || undefined,
        sourceUrl: cfg.sourceUrl,
        region: regionRaw.split(",")[0]?.trim() || undefined,
        sourceLayer: "gtc" as const,
      };
    },
    {
      outFields:
        "NO_MEF_LIEU,ADR_CIV_LIEU,LST_MRC_REG_ADM,LATITUDE,LONGITUDE,DESC_MILIEU_RECEPT,OBJECTID",
      maxRecords: cap,
      pageSize: 500,
      returnGeometry: false,
    }
  );
}

export async function fetchContaminationGtc(limit?: number): Promise<ContaminationRecord[]> {
  const cap = limit ?? getSyncLimit("contamination-gtc");
  const cfg = DATASETS["contamination-gtc"];

  try {
    const fromArcGis = await fetchContaminationGtcFromArcGis(cap);
    if (fromArcGis.length > 0) return fromArcGis;
  } catch (e) {
    console.warn("[contamination-gtc] ArcGIS fetch failed:", e);
  }

  const geoUrl = await fetchCkanResourceUrl(cfg.ckanId, ["GeoJSON", "JSON", "GPKG"]);
  if (geoUrl && !geoUrl.toLowerCase().endsWith(".gpkg")) {
    const features = await fetchDatasetGeoJson("contamination-gtc", cap);
    if (features.length > 0) {
      return mapGeoFeatures(
        features,
        (props, lat, lng, i) => ({
          externalId: `gtc-${pickProp(props, "id", "no_site", "nosite", "code") || i}`,
          address: pickProp(props, "adresse", "nom_site", "site") || undefined,
          borough: pickProp(props, "municipalite", "ville") || undefined,
          latitude: lat,
          longitude: lng,
          status: pickProp(props, "statut", "etat", "status") || undefined,
          description: pickProp(props, "description", "nom_site", "type_contamination") || undefined,
          sourceUrl: cfg.sourceUrl,
          region: pickProp(props, "region", "region_admin") || undefined,
          sourceLayer: "gtc" as const,
        }),
        cap
      );
    }
  }

  return [];
}

export type GtcContaminationRecord = ContaminationRecord & {
  region?: string;
  sourceLayer: "gtc";
};
