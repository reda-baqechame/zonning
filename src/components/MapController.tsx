"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { LatLngBounds } from "leaflet";

export function MapFitBounds({
  bounds,
  cityCenter,
}: {
  bounds?: LatLngBounds | null;
  cityCenter?: [number, number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      return;
    }
    if (cityCenter) {
      map.setView([cityCenter[0], cityCenter[1]], cityCenter[2]);
    }
  }, [map, bounds, cityCenter]);

  return null;
}

export function MapFlyTo({
  lat,
  lng,
  zoom = 15,
}: {
  lat?: number | null;
  lng?: number | null;
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], zoom, { duration: 0.5 });
    }
  }, [map, lat, lng, zoom]);

  return null;
}

export const CITY_MAP_CENTERS: Record<string, [number, number, number]> = {
  Montréal: [45.5017, -73.5673, 11],
  Laval: [45.6066, -73.7124, 11],
  Longueuil: [45.5312, -73.5185, 12],
  Québec: [46.8139, -71.208, 11],
  Sherbrooke: [45.4042, -71.8929, 12],
  Brossard: [45.4584, -73.4626, 13],
  Gatineau: [45.4765, -75.7013, 11],
  "Trois-Rivières": [46.3432, -72.5432, 12],
  Saguenay: [48.416, -71.0657, 11],
};
