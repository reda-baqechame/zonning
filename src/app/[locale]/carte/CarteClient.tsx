"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PermitMapClient from "@/components/PermitMapClient";
import type { OverlayPoint } from "@/components/PermitMap";
import { EmptyState } from "@/components/ui";

export type LayerStatus = "AVAILABLE" | "PARTIAL" | "POINT_ONLY" | "LIST_ONLY" | "NONE";

export type LayerInfo = {
  key: "permits" | "tenders" | "zoning" | "contamination" | "heritage" | "roadworks";
  count: number;
  mappable: number;
  status: LayerStatus;
  mapped: boolean;
  polygons?: number;
};

const STATUS_STYLES: Record<LayerStatus, string> = {
  AVAILABLE: "bg-emerald-500/20 text-emerald-300",
  PARTIAL: "bg-sky-500/20 text-sky-300",
  POINT_ONLY: "bg-amber-500/20 text-amber-300",
  LIST_ONLY: "bg-amber-500/20 text-amber-300",
  NONE: "bg-slate-500/20 text-slate-300",
};

const MAP_LAYERS = new Set<LayerInfo["key"]>([
  "permits",
  "contamination",
  "heritage",
  "zoning",
  "roadworks",
]);

const OVERLAY_KIND: Record<
  Exclude<LayerInfo["key"], "permits" | "tenders">,
  OverlayPoint["kind"]
> = {
  contamination: "gtc",
  heritage: "heritage",
  zoning: "zoning",
  roadworks: "roadwork",
};

type PermitPoint = {
  id: string;
  address: string;
  borough?: string | null;
  estimatedCost?: number | null;
  permitType: string;
  latitude: number;
  longitude: number;
  pipelineScore?: number;
};

type LayerPoint = { id: string; lat: number; lng: number; label?: string | null };

export default function CarteClient({ layers }: { layers: LayerInfo[] }) {
  const t = useTranslations("carte");
  const [active, setActive] = useState<LayerInfo["key"]>("permits");
  const [permits, setPermits] = useState<PermitPoint[]>([]);
  const [overlays, setOverlays] = useState<OverlayPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeLayer = layers.find((l) => l.key === active)!;

  useEffect(() => {
    if (!MAP_LAYERS.has(active)) return;
    let cancelled = false;

    async function loadLayer() {
      setLoading(true);
      try {
        if (active === "permits") {
          const res = await fetch("/api/permits?days=180");
          const d = await res.json();
          if (cancelled) return;
          setPermits((d.permits ?? []).filter((p: PermitPoint) => p.latitude && p.longitude));
          setOverlays([]);
          return;
        }

        const res = await fetch(`/api/map/layer?layer=${active}&limit=500`);
        const d = await res.json();
        if (cancelled) return;
        const kind = OVERLAY_KIND[active as keyof typeof OVERLAY_KIND];
        const points = (d.points ?? []) as LayerPoint[];
        setPermits([]);
        setOverlays(
          points.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            kind,
            label: p.label,
          })),
        );
      } catch {
        /* map shows empty */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLayer();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const showMap = MAP_LAYERS.has(active);
  const mappableCount = active === "permits" ? permits.length : overlays.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-slate-400">{t("subtitle")}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {layers.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setActive(l.key)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
              active === l.key
                ? "border-sky-500 bg-slate-800 text-white"
                : "border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {t(`layer.${l.key}`)}
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[l.status]}`}>
              {t(`status.${l.status}`)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-400">
        {t("layerCount", { count: activeLayer.count.toLocaleString() })}
        {activeLayer.key === "zoning" && activeLayer.polygons != null && (
          <span> · {t("polygonCount", { count: activeLayer.polygons.toLocaleString() })}</span>
        )}
      </div>

      <div className="mt-4">
        {showMap ? (
          mappableCount === 0 && !loading ? (
            <EmptyState
              title={t(`notMapped.${activeLayer.status === "NONE" ? "none" : "title"}`)}
              description={t(`notMapped.${activeLayer.key}`)}
              action={
                activeLayer.key === "zoning" ? (
                  <Link href="/intelligence" className="text-sm text-sky-400 hover:text-sky-300">
                    {t("openIntelligence")}
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <PermitMapClient
              permits={permits}
              devProjects={[]}
              overlayPoints={overlays}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id || null)}
              loading={loading}
              mappableCount={mappableCount}
              totalCount={mappableCount}
            />
          )
        ) : (
          <EmptyState
            title={t(`notMapped.${activeLayer.status === "NONE" ? "none" : "title"}`)}
            description={t(`notMapped.${activeLayer.key}`)}
            action={
              activeLayer.key === "tenders" ? (
                <Link href="/marches-qc" className="text-sm text-sky-400 hover:text-sky-300">
                  {t("openMarches")}
                </Link>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
