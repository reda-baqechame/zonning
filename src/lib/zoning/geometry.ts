/**
 * Pure geometry helpers for polygon zoning. No DB, no PostGIS — so the
 * point-in-polygon determination works identically in SQLite dev and as a
 * portable fallback in production when PostGIS isn't available.
 *
 * GeoJSON coordinates are [lng, lat]. A ring is an array of [lng, lat] points.
 */

export type Ring = [number, number][];
export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export type BBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/** Ray-casting point-in-ring test. `pt` is [lng, lat]. */
export function pointInRing(pt: [number, number], ring: Ring): boolean {
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** A polygon = outer ring minus holes (subsequent rings). */
export function pointInPolygon(pt: [number, number], rings: Ring[]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(pt, rings[0]!)) return false;
  // Inside outer ring, but excluded if it falls inside any hole.
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(pt, rings[i]!)) return false;
  }
  return true;
}

/** Point-in-geometry for Polygon or MultiPolygon. `lat`/`lng` are convenience. */
export function pointInGeometry(lat: number, lng: number, geom: GeoJsonGeometry): boolean {
  const pt: [number, number] = [lng, lat];
  if (geom.type === "Polygon") return pointInPolygon(pt, geom.coordinates);
  return geom.coordinates.some((poly) => pointInPolygon(pt, poly));
}

/** Parse + test in one call; returns false on malformed JSON. */
export function pointInGeoJson(lat: number, lng: number, geometryJson: string): boolean {
  try {
    const geom = JSON.parse(geometryJson) as GeoJsonGeometry;
    return pointInGeometry(lat, lng, geom);
  } catch {
    return false;
  }
}

/** Axis-aligned bounding box of a geometry, for cheap candidate filtering. */
export function geometryBBox(geom: GeoJsonGeometry): BBox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  const rings: Ring[] = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, maxLat, minLng, maxLng };
}

export function bboxContains(
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  lat: number,
  lng: number,
): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}

/** Build a simple square polygon (GeoJSON) around a centre — for demo seeding. */
export function squarePolygon(lat: number, lng: number, halfDeg: number): GeoJsonGeometry {
  const ring: Ring = [
    [lng - halfDeg, lat - halfDeg],
    [lng + halfDeg, lat - halfDeg],
    [lng + halfDeg, lat + halfDeg],
    [lng - halfDeg, lat + halfDeg],
    [lng - halfDeg, lat - halfDeg],
  ];
  return { type: "Polygon", coordinates: [ring] };
}
