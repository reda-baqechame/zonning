"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CoverageCity = {
  city: string;
  totalPermits: number;
  mappablePermits: number;
  coverageStatus: string;
  coverageLabel: string;
  coverageNote: string | null;
  sourceUrl: string | null;
};

type CoveragePayload = {
  datasetCount: number;
  registeredSources?: number;
  cities: CoverageCity[];
};

const CITY_COORDINATES: Record<string, [number, number]> = {
  "Montréal": [-73.5673, 45.5017],
  "Québec": [-71.208, 46.8139],
  Laval: [-73.7124, 45.6066],
  Longueuil: [-73.5181, 45.5312],
  Gatineau: [-75.7013, 45.4765],
  Sherbrooke: [-71.889, 45.4042],
  "Trois-Rivières": [-72.5421, 46.3432],
  Saguenay: [-71.0657, 48.428],
  "Lévis": [-71.1779, 46.7382],
  Terrebonne: [-73.6473, 45.7],
  Repentigny: [-73.45, 45.742],
  Brossard: [-73.452, 45.466],
  "Saint-Jean-sur-Richelieu": [-73.266, 45.307],
  Drummondville: [-72.482, 45.883],
  "Saint-Jérôme": [-74, 45.78],
  Granby: [-72.733, 45.4],
  "Saint-Hyacinthe": [-72.95, 45.63],
};

function markerStatus(status: string) {
  if (status === "authoritative") return "authoritative";
  if (status === "partial") return "partial";
  return "document";
}

export default function QuebecAtlasMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const [coverage, setCoverage] = useState<CoveragePayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/coverage/public")
      .then(async (response) => {
        if (!response.ok) throw new Error("Coverage unavailable");
        return (await response.json()) as CoveragePayload;
      })
      .then((payload) => {
        if (active) setCoverage(payload);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!coverage?.cities.length || !containerRef.current || mapRef.current) return;

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      if (!mounted || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        center: [-72.7, 47],
        zoom: 4.85,
        attributionControl: { compact: true },
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "OpenStreetMap contributors",
            },
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
              paint: {
                "raster-saturation": -0.65,
                "raster-contrast": -0.08,
                "raster-brightness-min": 0.82,
                "raster-brightness-max": 1,
              },
            },
          ],
        },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

      for (const city of coverage.cities) {
        const coordinates = CITY_COORDINATES[city.city];
        if (!coordinates) continue;

        const marker = document.createElement("div");
        marker.className = `atlas-marker atlas-marker--${markerStatus(city.coverageStatus)}`;
        marker.append(document.createElement("span"));

        const popupContent = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = city.city;
        const detail = document.createElement("p");
        detail.textContent = city.totalPermits
          ? `${city.totalPermits.toLocaleString("fr-CA")} indexed permits`
          : "No indexed permits";
        const status = document.createElement("p");
        status.textContent = city.coverageLabel;
        popupContent.append(title, detail, status);

        new maplibregl.Marker({ element: marker, anchor: "center" })
          .setLngLat(coordinates)
          .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(popupContent))
          .addTo(map);
      }
    })();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [coverage]);

  const indexedCities = useMemo(
    () => coverage?.cities.filter((city) => city.totalPermits > 0).length ?? 0,
    [coverage]
  );

  return (
    <div className="relative h-[520px] overflow-hidden rounded-2xl border border-line bg-[#eef5fb] shadow-[var(--shadow-2)]">
      <div ref={containerRef} className="absolute inset-0" aria-label="Quebec coverage map" />

      <div className="pointer-events-none absolute left-5 top-5 max-w-sm rounded-xl border border-line bg-white/95 p-4 shadow-[var(--shadow-1)] backdrop-blur">
        <p className="text-[10px] uppercase tracking-[0.22em] text-brand">Quebec coverage</p>
        {error ? (
          <p className="mt-2 text-sm font-semibold text-danger">Coverage data is unavailable.</p>
        ) : coverage ? (
          <>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {indexedCities} of {coverage.cities.length} tracked cities have indexed permits
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {coverage.datasetCount} working datasets and {coverage.registeredSources ?? coverage.datasetCount} registered sources. Registered does not mean indexed.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm font-semibold text-muted">Loading database-backed coverage...</p>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 grid gap-2 rounded-xl border border-line bg-white/95 p-4 text-xs text-muted shadow-[var(--shadow-1)] backdrop-blur">
        <span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />authoritative source</span>
        <span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-400" />partial coverage</span>
        <span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-slate-400" />document-only or unavailable</span>
      </div>
    </div>
  );
}
