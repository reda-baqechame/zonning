/**
 * Zoning lookup with an explicit determination so the UI never presents a
 * nearest-point guess as confirmed parcel zoning.
 *
 *  - "confirmed": the point falls inside a real zoning polygon (ST_Contains on
 *    PostGIS, or portable point-in-polygon on the stored GeoJSON).
 *  - "nearest_fallback": no polygon hit, but a nearby zoning point exists —
 *    a reference, not the lot's actual zoning.
 *  - "unknown": no polygon and no nearby point.
 */
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/datasets/geo";
import { bboxContains, pointInGeoJson } from "@/lib/zoning/geometry";

export type ZoningDetermination = "confirmed" | "nearest_fallback" | "unknown";

export type ZoningLookupResult = {
  determination: ZoningDetermination;
  zoneCode: string | null;
  landUse: string | null;
  intensificationLevel: string | null;
  description: string | null;
  regulationUrl: string | null;
  /** Distance (km) to the fallback point, when determination is nearest_fallback. */
  distanceKm: number | null;
  sourceUrl: string | null;
};

const NEAREST_MAX_KM = 0.4;

export async function lookupZoning(
  lat: number,
  lng: number,
  city?: string | null,
): Promise<ZoningLookupResult> {
  // 1) Polygon containment — the only source of a *confirmed* determination.
  const polygons = await prisma.zoningPolygon.findMany({
    where: {
      minLat: { lte: lat },
      maxLat: { gte: lat },
      minLng: { lte: lng },
      maxLng: { gte: lng },
    },
    take: 80,
  });

  for (const poly of polygons) {
    const bboxOk =
      poly.minLat == null ||
      poly.maxLat == null ||
      poly.minLng == null ||
      poly.maxLng == null ||
      bboxContains(
        { minLat: poly.minLat, maxLat: poly.maxLat, minLng: poly.minLng, maxLng: poly.maxLng },
        lat,
        lng,
      );
    if (!bboxOk) continue;
    if (pointInGeoJson(lat, lng, poly.geometryJson)) {
      return {
        determination: "confirmed",
        zoneCode: poly.zoneCode,
        landUse: poly.landUse,
        intensificationLevel: null,
        description: null,
        regulationUrl: poly.regulationUrl,
        distanceKm: 0,
        sourceUrl: poly.sourceUrl,
      };
    }
  }

  // 2) Nearest point — labelled as a fallback reference, never confirmed.
  const points = await prisma.zoningPoint.findMany({
    where: { ...(city ? { city } : {}) },
    take: 500,
  });
  let nearest: (typeof points)[number] | null = null;
  let nearestKm = Infinity;
  for (const p of points) {
    const d = haversineKm(lat, lng, p.latitude, p.longitude);
    if (d < nearestKm) {
      nearestKm = d;
      nearest = p;
    }
  }

  if (nearest && nearestKm <= NEAREST_MAX_KM) {
    return {
      determination: "nearest_fallback",
      zoneCode: nearest.zoneCode,
      landUse: nearest.landUse,
      intensificationLevel: nearest.intensificationLevel,
      description: nearest.description,
      regulationUrl: null,
      distanceKm: Math.round(nearestKm * 1000) / 1000,
      sourceUrl: nearest.sourceUrl,
    };
  }

  return {
    determination: "unknown",
    zoneCode: null,
    landUse: null,
    intensificationLevel: null,
    description: null,
    regulationUrl: null,
    distanceKm: null,
    sourceUrl: null,
  };
}
