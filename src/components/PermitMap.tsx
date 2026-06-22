"use client";

import { useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";
import { MapFitBounds, MapFlyTo, CITY_MAP_CENTERS } from "@/components/MapController";
import type { LeadSignalId } from "@/lib/lead-signals";

export type PermitMapPoint = {
  id: string;
  address: string;
  borough?: string | null;
  estimatedCost?: number | null;
  permitType: string;
  latitude: number;
  longitude: number;
  pipelineScore?: number;
  rbqFit?: { score: number; eligible: boolean };
  signals?: LeadSignalId[];
};

export type DevProjectPoint = {
  id: string;
  name?: string | null;
  latitude: number;
  longitude: number;
};

export type OverlayPoint = {
  id: string;
  lat: number;
  lng: number;
  kind: "gtc" | "heritage" | "zoning";
};

function scoreColor(score?: number, eligible?: boolean): string {
  if (eligible === false) return "#f59e0b";
  if (score == null) return eligible ? "#22c55e" : "#f59e0b";
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#0ea5e9";
  return "#f59e0b";
}

function pinIcon(color: string, selected: boolean) {
  const size = selected ? 18 : 14;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid ${selected ? "#fff" : color};box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapClickHandler({ onMapClick }: { onMapClick?: () => void }) {
  useMapEvents({
    click: () => onMapClick?.(),
  });
  return null;
}

export default function PermitMap({
  permits,
  devProjects = [],
  overlayPoints = [],
  selectedId,
  onSelect,
  city,
  loading,
  mappableCount,
  totalCount,
}: {
  permits: PermitMapPoint[];
  devProjects?: DevProjectPoint[];
  overlayPoints?: OverlayPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  city?: string;
  loading?: boolean;
  mappableCount?: number;
  totalCount?: number;
}) {
  const withCoords = permits.filter((p) => p.latitude && p.longitude);
  const selected = withCoords.find((p) => p.id === selectedId);

  const bounds = useMemo(() => {
    if (withCoords.length === 0 && devProjects.length === 0) return null;
    const all = [
      ...withCoords.map((p) => [p.latitude, p.longitude] as [number, number]),
      ...devProjects.map((d) => [d.latitude, d.longitude] as [number, number]),
    ];
    if (all.length === 0) return null;
    return L.latLngBounds(all);
  }, [withCoords, devProjects]);

  const cityCenter = city ? CITY_MAP_CENTERS[city] : null;
  const defaultCenter: [number, number] = cityCenter
    ? [cityCenter[0], cityCenter[1]]
    : [45.5017, -73.5673];
  const defaultZoom = cityCenter?.[2] ?? 11;

  return (
    <div className="relative h-[420px] w-full">
      {loading && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center rounded-xl bg-ink/70">
          <span className="text-sm text-surface">Chargement…</span>
        </div>
      )}
      {totalCount != null && mappableCount != null && mappableCount < totalCount && (
        <div className="absolute bottom-2 left-2 z-[500] rounded border border-line bg-surface/95 px-2 py-1 text-xs text-muted shadow-1">
          {mappableCount}/{totalCount} sur la carte
        </div>
      )}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full rounded-xl z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapFitBounds bounds={bounds} cityCenter={!bounds ? cityCenter : null} />
        {selected && <MapFlyTo lat={selected.latitude} lng={selected.longitude} />}
        <MapClickHandler onMapClick={() => onSelect?.("")} />
        <MarkerClusterGroup chunkedLoading maxClusterRadius={50}>
          {withCoords.map((p) => {
            const color = scoreColor(p.pipelineScore, p.rbqFit?.eligible);
            return (
              <Marker
                key={p.id}
                position={[p.latitude, p.longitude]}
                icon={pinIcon(color, selectedId === p.id)}
                eventHandlers={{
                  click: () => onSelect?.(p.id),
                }}
              >
                <Popup>
                  <div className="text-sm text-slate-100">
                    <p className="font-semibold">{p.permitType}</p>
                    <p>{p.address}</p>
                    {p.borough && <p className="text-slate-400">{p.borough}</p>}
                    {p.estimatedCost != null && (
                      <p>{p.estimatedCost.toLocaleString("fr-CA")} $</p>
                    )}
                    {p.pipelineScore != null && (
                      <p className="text-sky-300">Pipeline {p.pipelineScore}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
        {devProjects.map((d) => (
          <Marker
            key={`dev-${d.id}`}
            position={[d.latitude, d.longitude]}
            icon={pinIcon("#a855f7", false)}
          >
            <Popup>
              <div className="text-sm text-slate-100">
                <p className="font-semibold text-violet-300">Projet dev.</p>
                <p>{d.name ?? "Projet"}</p>
              </div>
            </Popup>
          </Marker>
        ))}
        {overlayPoints.map((o) => (
          <Marker
            key={`overlay-${o.id}`}
            position={[o.lat, o.lng]}
            icon={pinIcon(o.kind === "gtc" ? "#ef4444" : o.kind === "heritage" ? "#f59e0b" : "#8b5cf6", false)}
          >
            <Popup>
              <div className="text-sm text-slate-100">
                <p className="font-semibold">
                  {o.kind === "gtc" ? "GTC" : o.kind === "heritage" ? "Patrimoine" : "Zonage"}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
