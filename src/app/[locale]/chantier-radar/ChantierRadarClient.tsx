"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import PermitMapClient from "@/components/PermitMapClient";
import FreshnessBadge from "@/components/FreshnessBadge";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";

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
  };
  intelligence?: {
    assessment?: { totalValue?: number | null; yearBuilt?: number | null; floors?: number | null };
    recentTransaction?: { salePrice?: number | null };
    contamination?: { nearby: boolean; count: number; gtcNearby?: boolean; gtcCount?: number };
    propertyTax?: { amount?: number | null };
    zoning?: { densityZone?: string | null; maxFloors?: number | null; source?: string };
    heritage?: {
      nearby: boolean;
      count: number;
      hasEip: boolean;
      lpcProtected?: boolean;
      pum2050Listed?: boolean;
      nearestName?: string | null;
    };
    roadworks?: { nearby: boolean; count: number };
    municipalContracts?: { supplierMatches: number; totalAmount: number };
    marketHeat?: { permitCount: number; level: "hot" | "warm" | "cool" };
  };
};

export default function ChantierRadarClient() {
  const t = useTranslations("chantier");
  const tc = useTranslations("compliance");
  const [permits, setPermits] = useState<Permit[]>([]);
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
    }[]
  >([]);

  const showDevProjects = city === "Sherbrooke" || city === "Brossard";

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ sort: "pipeline" });
    if (borough) params.set("borough", borough);
    if (city) params.set("city", city);
    if (minCost) params.set("minCost", minCost);
    if (permitType) params.set("permitType", permitType);
    if (eligibleOnly) params.set("eligibleOnly", "true");
    if (noGtc) params.set("noGtc", "true");
    if (days) params.set("days", days);

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
    setPermits(data.permits ?? []);

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

    setLoading(false);
  }, [borough, city, minCost, permitType, eligibleOnly, noGtc, days, showDevProjects]);

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
      rbqFit: p.rbqFit,
    }));

  const createAlert = async () => {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: "chantier_radar",
        filters: { borough, city, minCost, permitType, eligibleOnly, noGtc },
      }),
    });
    alert("Alerte créée!");
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
      alert(data.error ?? "Erreur");
      return;
    }
    window.open(`/api/compliance?id=${data.record.id}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <div className="mt-2">
        <FreshnessBadge datasetId="permits" />
      </div>

      <div className="mt-6 grid gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="text-xs text-slate-400">{t("borough")}</label>
          <input
            value={borough}
            onChange={(e) => setBorough(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Ville-Marie"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Ville</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Toutes</option>
            {COVERAGE_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">{t("permitType")}</label>
          <input
            value={permitType}
            onChange={(e) => setPermitType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Construction, Démolition..."
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">{t("minCost")}</label>
          <input
            value={minCost}
            onChange={(e) => setMinCost(e.target.value)}
            type="number"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="100000"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">{t("days")}</label>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="30">30 {t("daysLabel")}</option>
            <option value="90">90 {t("daysLabel")}</option>
            <option value="180">180 {t("daysLabel")}</option>
          </select>
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
          <button
            onClick={load}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600"
          >
            {t("filters")}
          </button>
          <button
            onClick={createAlert}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium hover:bg-sky-400"
          >
            {t("createAlert")}
          </button>
        </div>
      </div>

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

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
        <PermitMapClient permits={mapPoints} />
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : permits.length === 0 ? (
          <p className="text-slate-400">{t("noPermits")}</p>
        ) : (
          permits.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 md:flex md:items-center md:justify-between"
            >
              <div>
                <p className="font-semibold text-white">
                  {p.permitType}
                  {p.city && p.city !== "Montréal" && (
                    <span className="ml-2 rounded bg-slate-700 px-2 py-0.5 text-xs">{p.city}</span>
                  )}
                </p>
                <p className="text-sm text-slate-400">
                  {p.address} · {p.borough}
                </p>
                {p.pipelineScore != null && (
                  <p className="mt-1 text-sm text-sky-300">
                    Pipeline Score: <strong>{p.pipelineScore}</strong>
                    {p.pipeline?.competitionCount != null && (
                      <span className="text-slate-500"> · {p.pipeline.competitionCount} concurrents (90j)</span>
                    )}
                  </p>
                )}
                {p.pipeline?.densityGapLabelFr && (
                  <p className="text-xs text-indigo-300">{p.pipeline.densityGapLabelFr}</p>
                )}
                {p.intelligence && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.intelligence.assessment?.totalValue && (
                      <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs text-violet-300">
                        Éval. {p.intelligence.assessment.totalValue.toLocaleString("fr-CA")} $
                      </span>
                    )}
                    {p.intelligence.contamination?.gtcNearby ? (
                      <span className="rounded-full bg-red-600/30 px-2 py-0.5 text-xs text-red-200">
                        GTC ({p.intelligence.contamination.gtcCount ?? 1})
                      </span>
                    ) : p.intelligence.contamination?.nearby ? (
                      <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                        Contamination ({p.intelligence.contamination.count})
                      </span>
                    ) : null}
                    {p.intelligence.zoning?.densityZone && (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                        {p.intelligence.zoning.source === "regional" ? "Zonage" : "PUM 2050"}:{" "}
                        {p.intelligence.zoning.densityZone}
                      </span>
                    )}
                    {p.intelligence.heritage?.lpcProtected && (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                        LPC protégé
                      </span>
                    )}
                    {p.intelligence.heritage?.nearby && !p.intelligence.heritage.lpcProtected && (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        Patrimoine{p.intelligence.heritage.hasEip ? " (EIP)" : ""} ({p.intelligence.heritage.count})
                      </span>
                    )}
                    {p.intelligence.roadworks?.nearby && (
                      <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
                        Travaux actifs ({p.intelligence.roadworks.count})
                      </span>
                    )}
                    {p.intelligence.municipalContracts?.supplierMatches ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        Fournisseur Ville ({p.intelligence.municipalContracts.supplierMatches})
                      </span>
                    ) : null}
                    {p.intelligence.marketHeat?.level === "hot" && (
                      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-300">
                        Marché chaud · {p.intelligence.marketHeat.permitCount} permis
                      </span>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => createCompliance(p)}
                  className="mt-2 text-xs text-sky-400 hover:text-sky-300"
                >
                  {tc("createFromPermit")} →
                </button>
              </div>
              <div className="mt-2 text-right md:mt-0">
                {p.estimatedCost && (
                  <p className="font-mono text-sky-300">
                    {p.estimatedCost.toLocaleString("fr-CA")} $
                  </p>
                )}
                <p
                  className={`text-sm font-medium ${
                    p.rbqFit.eligible ? "text-green-400" : "text-amber-400"
                  }`}
                >
                  {t("rbqFit")}: {p.rbqFit.score}% —{" "}
                  {p.rbqFit.eligible ? t("eligible") : t("notEligible")}
                </p>
                <p className="text-xs text-slate-500">{p.rbqFit.reasonFr}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
