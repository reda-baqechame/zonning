"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import PermitMapClient from "@/components/PermitMapClient";
import FreshnessBadge from "@/components/FreshnessBadge";
import MarketPulseBar from "@/components/MarketPulseBar";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import { LeadCard } from "@/components/LeadCard";
import { intelAccessForPlan } from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";
import { createAlert } from "@/lib/alerts/create-alert";
import type { LeadSignal } from "@/lib/lead-signals";
import {
  PageHeader,
  Input,
  Select,
  FieldLabel,
  Button,
  SkeletonList,
  EmptyState,
  useToast,
  FadeIn,
} from "@/components/ui";

type Permit = {
  id: string;
  address: string;
  borough?: string | null;
  city?: string | null;
  estimatedCost?: number | null;
  permitType: string;
  latitude?: number | null;
  longitude?: number | null;
  applicantName?: string | null;
  sourceUrl?: string;
  rbqFit: { score: number; eligible: boolean; reasonFr: string };
  pipelineScore?: number;
  pipeline?: {
    competitionCount?: number;
    densityGapLabelFr?: string;
    breakdown?: {
      rbqFit: number;
      costFit: number;
      competition: number;
      intelligence: number;
      zoning: number;
    };
  };
  signals?: LeadSignal[];
  intelligence?: PropertyIntelligence;
};

export default function ChantierRadarClient() {
  const t = useTranslations("chantier");
  const c = useTranslations("common");
  const locale = useLocale();
  const { success, error: toastError } = useToast();
  const [permits, setPermits] = useState<Permit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [complianceEntitled, setComplianceEntitled] = useState(false);
  const [userPlan, setUserPlan] = useState("FREE");
  const [showDevOnMap, setShowDevOnMap] = useState(true);
  const [showGtcLayer, setShowGtcLayer] = useState(false);
  const [showHeritageLayer, setShowHeritageLayer] = useState(false);
  const [mapOverlays, setMapOverlays] = useState<
    { id: string; lat: number; lng: number; kind: "gtc" | "heritage" | "zoning" }[]
  >([]);
  const [mappableCount, setMappableCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [diagnostics, setDiagnostics] = useState<{
    rawIndexed: number;
    afterDateFilter: number;
    afterFilters: number;
    mappable: number;
    days: number;
    lastSyncAt: string | null;
    zeroReason: string | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [borough, setBorough] = useState("");
  const [city, setCity] = useState("");
  const [minCost, setMinCost] = useState("");
  const [permitType, setPermitType] = useState("");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [noGtc, setNoGtc] = useState(false);
  const [days, setDays] = useState("90");
  const [loading, setLoading] = useState(true);
  const [boroughDelays, setBoroughDelays] = useState<
    { borough: string; phase?: string | null; medianDays?: number | null; targetDays?: number | null }[]
  >([]);
  const [devProjects, setDevProjects] = useState<
    {
      id: string;
      name?: string | null;
      city: string;
      address?: string | null;
      unitsPlanned?: number | null;
      projectUrl?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }[]
  >([]);

  const showDevProjects = city === "Sherbrooke" || city === "Brossard";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ sort: "pipeline" });
    if (borough) params.set("borough", borough);
    if (city) params.set("city", city);
    if (minCost) params.set("minCost", minCost);
    if (permitType) params.set("permitType", permitType);
    if (eligibleOnly) params.set("eligibleOnly", "true");
    if (noGtc) params.set("noGtc", "true");
    if (days) params.set("days", days);

    try {
      const [permitsRes, delaysRes, projectsRes] = await Promise.all([
        fetch(`/api/permits?${params}`),
        borough
          ? fetch(`/api/permit-delays?borough=${encodeURIComponent(borough)}`)
          : Promise.resolve(null),
        showDevProjects
          ? fetch(`/api/development-projects?city=${encodeURIComponent(city)}`)
          : Promise.resolve(null),
      ]);

      const data = await permitsRes.json();
      if (!permitsRes.ok) {
        setLoadError(data.error ?? c("error"));
        setPermits([]);
        return;
      }
      setPermits(data.permits ?? []);
      setComplianceEntitled(data.complianceEntitled ?? false);
      setUserPlan(data.plan ?? "FREE");
      setMappableCount(data.mappable ?? 0);
      setTotalCount(data.total ?? data.permits?.length ?? 0);
      setDiagnostics(data.diagnostics ?? null);

      if (delaysRes) {
        const delaysData = await delaysRes.json();
        setBoroughDelays(delaysData.delays ?? []);
      } else {
        setBoroughDelays([]);
      }

      if (projectsRes) {
        const projectsData = await projectsRes.json();
        setDevProjects(projectsData.projects ?? []);
      } else {
        setDevProjects([]);
      }
    } catch {
      setLoadError(c("error"));
    } finally {
      setLoading(false);
    }
  }, [borough, city, minCost, permitType, eligibleOnly, noGtc, days, showDevProjects, c]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const mapPoints = permits
    .filter((p) => p.latitude && p.longitude)
    .map((p) => ({
      id: p.id,
      address: p.address,
      borough: p.borough,
      estimatedCost: p.estimatedCost,
      permitType: p.permitType,
      latitude: p.latitude!,
      longitude: p.longitude!,
      pipelineScore: p.pipelineScore,
      rbqFit: p.rbqFit,
    }));

  const devMapPoints = devProjects
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude!,
      longitude: p.longitude!,
    }));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!showGtcLayer && !showHeritageLayer) {
        if (!cancelled) setMapOverlays([]);
        return;
      }
      const center = permits.find((p) => p.latitude && p.longitude);
      if (!center?.latitude || !center.longitude) return;
      const layers = [showGtcLayer && "gtc", showHeritageLayer && "heritage"]
        .filter(Boolean)
        .join(",");
      try {
        const res = await fetch(
          `/api/map/overlays?lat=${center.latitude}&lng=${center.longitude}&layers=${layers}`
        );
        const d = await res.json();
        if (!cancelled) setMapOverlays(d.points ?? []);
      } catch {
        if (!cancelled) setMapOverlays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showGtcLayer, showHeritageLayer, permits]);

  const intelAccess = intelAccessForPlan(userPlan);

  const handleCreateAlert = async () => {
    const result = await createAlert({
      module: "chantier_radar",
      filters: { borough, city, minCost, permitType, eligibleOnly, noGtc },
    });
    if (!result.ok) {
      toastError(result.error);
      return;
    }
    success(c("alertCreated"));
  };

  const createCompliance = async (p: Permit) => {
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: p.applicantName ?? "Demandeur permis",
        sourceType: "permit_public_registry",
        sourceUrl: p.sourceUrl ?? `${window.location.origin}/fr/chantier-radar`,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toastError(data.error ?? c("error"));
      return;
    }
    window.open(`/api/compliance?id=${data.record.id}`, "_blank");
  };

  return (
    <FadeIn className="mx-auto max-w-7xl px-4 py-10">
      <MarketPulseBar compact />
      <div className="mb-4">
        <QuebecCoverageBar compact />
      </div>
      <PageHeader
        title={t("title")}
        subtitle={t("filters")}
        action={<FreshnessBadge datasetId="permits" />}
      />

      <div className="mt-6 grid gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:grid-cols-2 lg:grid-cols-6">
        <div>
          <FieldLabel htmlFor="borough">{t("borough")}</FieldLabel>
          <Input
            id="borough"
            value={borough}
            onChange={(e) => setBorough(e.target.value)}
            placeholder="Ville-Marie"
          />
        </div>
        <div>
          <FieldLabel htmlFor="city">Ville</FieldLabel>
          <Select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">Toutes</option>
            {COVERAGE_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="permitType">{t("permitType")}</FieldLabel>
          <Input
            id="permitType"
            value={permitType}
            onChange={(e) => setPermitType(e.target.value)}
            placeholder="Construction, Démolition..."
          />
        </div>
        <div>
          <FieldLabel htmlFor="minCost">{t("minCost")}</FieldLabel>
          <Input
            id="minCost"
            value={minCost}
            onChange={(e) => setMinCost(e.target.value)}
            type="number"
            placeholder="100000"
          />
        </div>
        <div>
          <FieldLabel htmlFor="days">{t("days")}</FieldLabel>
          <Select id="days" value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="30">30 {t("daysLabel")}</option>
            <option value="90">90 {t("daysLabel")}</option>
            <option value="180">180 {t("daysLabel")}</option>
          </Select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={eligibleOnly}
              onChange={(e) => setEligibleOnly(e.target.checked)}
            />
            {t("eligible")} RBQ
          </label>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={noGtc}
              onChange={(e) => setNoGtc(e.target.checked)}
            />
            {t("noGtc")}
          </label>
        </div>
        <div className="flex items-end gap-2 lg:col-span-2">
          <Button variant="secondary" onClick={() => void load()}>
            {t("filters")}
          </Button>
          <Button onClick={() => void handleCreateAlert()}>{t("createAlert")}</Button>
        </div>
      </div>

      {loadError && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
          {loadError}
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => void load()}>
            {c("retry")}
          </Button>
        </div>
      )}

      <p className="mt-2 text-sm text-slate-500">
        {t("resultSummary", {
          count: permits.length,
          total: totalCount,
          mappable: mappableCount,
        })}
      </p>

      {boroughDelays.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm font-medium text-slate-300">
            {t("permitDelays")} — {borough}
          </p>
          <ul className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
            {boroughDelays.map((d, i) => (
              <li key={i} className="rounded bg-slate-950 px-2 py-1">
                {d.phase ?? "Permis"}: {d.medianDays ?? "—"} j (cible {d.targetDays ?? "—"} j)
              </li>
            ))}
          </ul>
        </div>
      )}

      {devProjects.length > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-300">
            {t("devProjects")} — {city} ({devProjects.length})
          </p>
          <ul className="mt-2 space-y-2 text-sm text-slate-400">
            {devProjects.slice(0, 8).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{p.name ?? p.address ?? "Projet résidentiel"}</span>
                {p.unitsPlanned != null && (
                  <span className="text-xs text-slate-500">{p.unitsPlanned} unités</span>
                )}
                {p.projectUrl && (
                  <a
                    href={p.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-400 hover:underline"
                  >
                    {t("viewProject")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5 text-slate-400">
          <input
            type="checkbox"
            checked={showDevOnMap}
            onChange={(e) => setShowDevOnMap(e.target.checked)}
          />
          {t("layerDevProjects")}
        </label>
        <label className="flex items-center gap-1.5 text-slate-400">
          <input
            type="checkbox"
            checked={showGtcLayer}
            onChange={(e) => setShowGtcLayer(e.target.checked)}
          />
          {t("layerGtc")}
        </label>
        <label className="flex items-center gap-1.5 text-slate-400">
          <input
            type="checkbox"
            checked={showHeritageLayer}
            onChange={(e) => setShowHeritageLayer(e.target.checked)}
          />
          {t("layerHeritage")}
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="overflow-hidden rounded-xl border border-slate-800 lg:col-span-3">
          <PermitMapClient
            permits={mapPoints}
            devProjects={showDevOnMap ? devMapPoints : []}
            overlayPoints={mapOverlays}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id || null)}
            city={city || undefined}
            loading={loading}
            mappableCount={mappableCount}
            totalCount={permits.length}
          />
        </div>

        <div className="space-y-3 lg:col-span-2">
          {loading ? (
            <SkeletonList count={3} />
          ) : permits.length === 0 ? (
            <EmptyState
              title={t("noPermits")}
              description={
                diagnostics?.zeroReason
                  ? t(`zeroReason.${diagnostics.zeroReason}`)
                  : undefined
              }
              action={
                diagnostics ? (
                  <div className="w-full max-w-sm space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left text-xs text-slate-400">
                    <div className="flex justify-between"><span>{t("diag.rawIndexed")}</span><span className="font-mono text-slate-200">{diagnostics.rawIndexed.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>{t("diag.afterDate", { days: diagnostics.days })}</span><span className="font-mono text-slate-200">{diagnostics.afterDateFilter.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>{t("diag.afterFilters")}</span><span className="font-mono text-slate-200">{diagnostics.afterFilters.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>{t("diag.mappable")}</span><span className="font-mono text-slate-200">{diagnostics.mappable.toLocaleString()}</span></div>
                    {diagnostics.lastSyncAt && (
                      <div className="flex justify-between border-t border-slate-800 pt-1"><span>{t("diag.lastSync")}</span><span className="text-slate-300">{new Date(diagnostics.lastSyncAt).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")}</span></div>
                    )}
                  </div>
                ) : undefined
              }
            />
          ) : (
            permits.map((p) => (
              <LeadCard
                key={p.id}
                locale={locale}
                selected={selectedId === p.id}
                complianceEnabled={complianceEntitled}
                onSelect={() => setSelectedId(p.id)}
                onCompliance={() => createCompliance(p)}
                item={{
                  kind: "permit",
                  id: p.id,
                  score: p.pipelineScore ?? p.rbqFit.score,
                  signals: p.signals ?? [],
                  permitType: p.permitType,
                  address: p.address,
                  borough: p.borough,
                  estimatedCost: p.estimatedCost,
                  rbqFit: p.rbqFit,
                  pipeline: p.pipeline,
                  sourceUrl: p.sourceUrl,
                  applicantName: p.applicantName,
                }}
                intelligence={p.intelligence}
                intelAccess={intelAccess}
              />
            ))
          )}
        </div>
      </div>
    </FadeIn>
  );
}
