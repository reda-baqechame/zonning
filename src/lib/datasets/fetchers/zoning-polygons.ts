import { fetchJson } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { geometryBBox, type GeoJsonGeometry } from "@/lib/zoning/geometry";

export type ZoningPolygonRow = {
  externalId: string;
  city: string;
  zoneCode?: string;
  landUse?: string;
  regulationUrl?: string;
  geometryJson: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  sourceUrl: string;
};

type GeoFeature = {
  properties?: Record<string, unknown>;
  geometry?: GeoJsonGeometry;
};

type GeoCollection = { features?: GeoFeature[] };

function parsePolygonFeature(
  feature: GeoFeature,
  index: number,
  sourceUrl: string,
): ZoningPolygonRow | null {
  const geom = feature.geometry;
  if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) return null;

  const props = feature.properties ?? {};
  const zoneCode =
    String(props.NO_ZONAGE ?? props.zone ?? props.code ?? props.zonage ?? "").trim() || undefined;
  const city =
    String(props.MUNICIPALITE ?? props.municipalite ?? props.city ?? props.MUN_NOM ?? "").trim() ||
    "Québec";
  const regulationUrl =
    String(props.URL_GRILLE ?? props.url_grille ?? props.regulation_url ?? "").trim() || undefined;

  const bbox = geometryBBox(geom);
  if (!Number.isFinite(bbox.minLat) || bbox.minLat === Infinity) return null;

  const externalId = String(
    props.OBJECTID ?? props.objectid ?? props.id ?? `zon-poly-${index}`,
  );

  return {
    externalId: `zoning-standard:${externalId}`,
    city,
    zoneCode,
    landUse: zoneCode,
    regulationUrl,
    geometryJson: JSON.stringify(geom),
    minLat: bbox.minLat,
    maxLat: bbox.maxLat,
    minLng: bbox.minLng,
    maxLng: bbox.maxLng,
    sourceUrl,
  };
}

/** Provincial normalized zoning polygons (plan-de-zonage GeoJSON). */
export async function fetchZoningStandardPolygons(
  opts: { limit?: number } = {},
): Promise<ZoningPolygonRow[]> {
  const cfg = DATASETS["zoning-standard"];
  const limit = opts.limit ?? getSyncLimit("zoning-standard");
  const url = cfg.directResourceUrl;
  if (!url) return [];

  try {
    const geo = await fetchJson<GeoCollection>(url);
    const features = geo?.features ?? [];
    const rows: ZoningPolygonRow[] = [];
    for (let i = 0; i < features.length && rows.length < limit; i++) {
      const row = parsePolygonFeature(features[i]!, i, cfg.sourceUrl);
      if (row) rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}
