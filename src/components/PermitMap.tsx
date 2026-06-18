"use client";

import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type PermitMapPoint = {
  id: string;
  address: string;
  borough?: string | null;
  estimatedCost?: number | null;
  permitType: string;
  latitude: number;
  longitude: number;
  rbqFit?: { score: number; eligible: boolean };
};

export default function PermitMap({ permits }: { permits: PermitMapPoint[] }) {
  const withCoords = permits.filter((p) => p.latitude && p.longitude);

  return (
    <MapContainer
      center={[45.5017, -73.5673]}
      zoom={11}
      className="h-[420px] w-full rounded-xl z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {withCoords.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.latitude, p.longitude]}
          radius={8}
          pathOptions={{
            color: p.rbqFit?.eligible ? "#22c55e" : "#f59e0b",
            fillColor: p.rbqFit?.eligible ? "#22c55e" : "#f59e0b",
            fillOpacity: 0.8,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{p.permitType}</p>
              <p>{p.address}</p>
              {p.borough && <p>{p.borough}</p>}
              {p.estimatedCost && (
                <p>{p.estimatedCost.toLocaleString("fr-CA")} $</p>
              )}
              {p.rbqFit && (
                <p className={p.rbqFit.eligible ? "text-green-700" : "text-amber-700"}>
                  RBQ-Fit: {p.rbqFit.score}%
                </p>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
