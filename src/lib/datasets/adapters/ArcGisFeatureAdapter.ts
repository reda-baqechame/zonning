import { fetchJson } from "../client";

export type ArcGisFeature = {
  attributes: Record<string, unknown>;
  geometry?: {
    x?: number;
    y?: number;
    rings?: number[][][];
    paths?: number[][][];
  };
};

type ArcGisQueryResponse = {
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
};

export type ArcGisFetchOptions = {
  where?: string;
  outFields?: string;
  pageSize?: number;
  maxRecords?: number;
  returnGeometry?: boolean;
};

function featureCentroid(feature: ArcGisFeature): { latitude: number; longitude: number } | null {
  const attrs = feature.attributes ?? {};
  const attrLat = Number(attrs.LATITUDE ?? attrs.latitude);
  const attrLng = Number(attrs.LONGITUDE ?? attrs.longitude);
  if (Number.isFinite(attrLat) && Number.isFinite(attrLng)) {
    return { latitude: attrLat, longitude: attrLng };
  }

  const g = feature.geometry;
  if (!g) return null;
  if (g.x != null && g.y != null) {
    return { longitude: g.x, latitude: g.y };
  }
  const ring = g.rings?.[0];
  if (ring?.length) {
    let sumX = 0;
    let sumY = 0;
    for (const [x, y] of ring) {
      sumX += x;
      sumY += y;
    }
    return { longitude: sumX / ring.length, latitude: sumY / ring.length };
  }
  const path = g.paths?.[0];
  if (path?.length) {
    const [x, y] = path[0];
    return { longitude: x, latitude: y };
  }
  return null;
}

/** Paginated ArcGIS FeatureServer / MapServer layer query. */
export class ArcGisFeatureAdapter {
  async queryAll<T>(
    layerUrl: string,
    mapFeature: (
      attrs: Record<string, unknown>,
      centroid: { latitude: number; longitude: number },
      index: number
    ) => T | null,
    options: ArcGisFetchOptions = {}
  ): Promise<T[]> {
    const pageSize = options.pageSize ?? 1000;
    const maxRecords = options.maxRecords ?? 5000;
    const where = options.where ?? "1=1";
    const outFields = options.outFields ?? "*";
    const returnGeometry = options.returnGeometry !== false;

    const base = layerUrl.replace(/\/$/, "");
    const queryUrl = base.includes("/query") ? base : `${base}/query`;

    const results: T[] = [];
    let offset = 0;

    while (results.length < maxRecords) {
      const params = new URLSearchParams({
        where,
        outFields,
        returnGeometry: returnGeometry ? "true" : "false",
        outSR: "4326",
        f: "json",
        resultOffset: String(offset),
        resultRecordCount: String(pageSize),
      });

      const data = await fetchJson<ArcGisQueryResponse>(`${queryUrl}?${params}`);
      const features = data?.features ?? [];
      if (features.length === 0) break;

      for (let i = 0; i < features.length && results.length < maxRecords; i++) {
        const centroid = featureCentroid(features[i]);
        if (!centroid) continue;
        const mapped = mapFeature(features[i].attributes ?? {}, centroid, offset + i);
        if (mapped) results.push(mapped);
      }

      if (!data?.exceededTransferLimit && features.length < pageSize) break;
      offset += features.length;
    }

    return results;
  }
}

export const arcGisFeature = new ArcGisFeatureAdapter();
