import { DATASETS, getSyncLimit } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";
import { buildZoningExternalId } from "@/lib/zoning/record-quality";
import { geometryBBox, type GeoJsonGeometry } from "@/lib/zoning/geometry";

export type Pum2050ZoningRecord = {
  externalId: string;
  city: string;
  borough?: string;
  latitude: number;
  longitude: number;
  landUse?: string;
  intensificationLevel?: string;
  densityThreshold?: number;
  zoneCode?: string;
  description?: string;
  sourceUrl: string;
};

export type Pum2050PolygonRow = {
  externalId: string;
  city: string;
  borough?: string;
  zoneCode?: string;
  landUse?: string;
  intensificationLevel?: string;
  regulationUrl?: string;
  geometryJson: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  sourceUrl: string;
};

function pum2050Props(props: Record<string, unknown>) {
  const borough = pickProp(props, "arrondissement", "borough", "nom_arrondissement");
  const landUse = pickProp(
    props,
    "affectation",
    "AFFECTATION",
    "affectatio",
    "affectation_sol",
    "landuse",
    "AFFECT_SOL",
  );
  const intensification = pickProp(
    props,
    "niv_txt",
    "NIV_TXT",
    "niveau_intensification",
    "niveauint",
    "intensification",
    "niv_intensification",
    "NIV_INT",
  );
  const densityStr = pickProp(
    props,
    "densite",
    "DENSITE",
    "seuil_densite",
    "densite_nette",
    "DENS_NETTE",
  );
  const densityThreshold = densityStr
    ? Number(densityStr.replace(/\s/g, "").replace(",", "."))
    : undefined;

  return {
    borough: borough || undefined,
    landUse: landUse || undefined,
    intensificationLevel: intensification || undefined,
    densityThreshold:
      Number.isFinite(densityThreshold) && densityThreshold! > 0 ? densityThreshold : undefined,
    zoneCode: pickProp(props, "code_zone", "zone", "CODE_ZONE") || undefined,
    objectId: pickProp(props, "objectid", "OBJECTID", "id", "fid", "uuid"),
  };
}

export async function fetchPum2050Zoning(limit?: number): Promise<Pum2050ZoningRecord[]> {
  const cap = limit ?? getSyncLimit("pum2050-zoning");
  const cfg = DATASETS["pum2050-zoning"];
  const features = await fetchDatasetGeoJson("pum2050-zoning", cap);

  return mapGeoFeatures(
    features,
    (props, lat, lng) => {
      const parsed = pum2050Props(props);
      const record = {
        city: "Montréal",
        latitude: lat,
        longitude: lng,
        landUse: parsed.landUse,
        intensificationLevel: parsed.intensificationLevel,
        densityThreshold: parsed.densityThreshold,
        zoneCode: parsed.zoneCode,
        sourceUrl: cfg.sourceUrl,
      };
      const externalId = buildZoningExternalId("pum2050-zoning", parsed.objectId, record);
      if (!externalId) return null;

      return {
        externalId,
        ...record,
        borough: parsed.borough,
        description: parsed.landUse
          ? `PUM 2050 — ${parsed.landUse}${parsed.intensificationLevel ? ` (${parsed.intensificationLevel})` : ""}`
          : "PUM 2050",
      };
    },
    cap,
  );
}

/** Full PUM 2050 polygons for confirmed parcel-level zoning in Montréal. */
export async function fetchPum2050ZoningPolygons(
  limit?: number,
): Promise<Pum2050PolygonRow[]> {
  const cap = limit ?? getSyncLimit("pum2050-zoning");
  const cfg = DATASETS["pum2050-zoning"];
  const features = await fetchDatasetGeoJson("pum2050-zoning", cap);
  const rows: Pum2050PolygonRow[] = [];

  for (let i = 0; i < features.length && rows.length < cap; i++) {
    const feature = features[i]!;
    const geom = feature.geometry as GeoJsonGeometry | undefined;
    if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) continue;

    const parsed = pum2050Props(feature.properties ?? {});
    const bbox = geometryBBox(geom);
    if (!Number.isFinite(bbox.minLat) || bbox.minLat === Infinity) continue;

    const externalId = parsed.objectId
      ? `pum2050-poly:${parsed.objectId}`
      : `pum2050-poly:${i}`;

    rows.push({
      externalId,
      city: "Montréal",
      borough: parsed.borough,
      zoneCode: parsed.zoneCode,
      landUse: parsed.landUse ?? parsed.zoneCode,
      intensificationLevel: parsed.intensificationLevel,
      regulationUrl: cfg.sourceUrl,
      geometryJson: JSON.stringify(geom),
      minLat: bbox.minLat,
      maxLat: bbox.maxLat,
      minLng: bbox.minLng,
      maxLng: bbox.maxLng,
      sourceUrl: cfg.sourceUrl,
    });
  }

  return rows;
}
