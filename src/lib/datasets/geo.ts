export type GeoCentroid = {
  latitude: number;
  longitude: number;
};

type GeoPosition = number[] | number[][] | number[][][];

function ringCentroid(ring: number[][]): GeoCentroid | null {
  if (ring.length < 3) return null;
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const coord of ring) {
    if (coord.length < 2) continue;
    sumLng += coord[0];
    sumLat += coord[1];
    n++;
  }
  if (n === 0) return null;
  return { longitude: sumLng / n, latitude: sumLat / n };
}

function centroidFromCoords(coords: GeoPosition): GeoCentroid | null {
  if (!coords.length) return null;

  if (typeof coords[0] === "number") {
    const [lng, lat] = coords as number[];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }

  if (typeof coords[0][0] === "number") {
    return ringCentroid(coords as number[][]);
  }

  const poly = coords as number[][][];
  const outer = poly[0];
  return outer ? ringCentroid(outer) : null;
}

export function centroidFromGeometry(
  geometry?: { type?: string; coordinates?: GeoPosition }
): GeoCentroid | null {
  if (!geometry?.coordinates) return null;
  const { type, coordinates } = geometry;

  if (type === "Point") {
    return centroidFromCoords(coordinates);
  }
  if (type === "MultiPoint") {
    const pts = coordinates as number[][];
    if (!pts.length) return null;
    const sum = pts.reduce(
      (acc, [lng, lat]) => ({ lat: acc.lat + lat, lng: acc.lng + lng }),
      { lat: 0, lng: 0 }
    );
    return { latitude: sum.lat / pts.length, longitude: sum.lng / pts.length };
  }
  if (type === "LineString") {
    return centroidFromCoords(coordinates);
  }
  if (type === "Polygon" || type === "MultiPolygon") {
    if (type === "MultiPolygon") {
      const polys = coordinates as unknown as number[][][][];
      return polys[0] ? ringCentroid(polys[0][0]) : null;
    }
    return centroidFromCoords(coordinates);
  }

  return centroidFromCoords(coordinates);
}

export type GeoFeatureWithProps = {
  type?: string;
  geometry?: { type?: string; coordinates?: GeoPosition };
  properties?: Record<string, unknown>;
};

export function parseGeoJsonCentroids<T extends Record<string, unknown>>(
  features: GeoFeatureWithProps[],
  mapProps: (props: Record<string, unknown>, centroid: GeoCentroid, index: number) => T | null,
  maxFeatures = 8000
): T[] {
  const results: T[] = [];
  for (let i = 0; i < Math.min(features.length, maxFeatures); i++) {
    const feature = features[i];
    const centroid = centroidFromGeometry(feature.geometry);
    if (!centroid) continue;
    const props = feature.properties ?? {};
    const mapped = mapProps(props, centroid, i);
    if (mapped) results.push(mapped);
  }
  return results;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
