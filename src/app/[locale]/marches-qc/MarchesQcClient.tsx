"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import FreshnessBadge from "@/components/FreshnessBadge";
import TenderCountdown from "@/components/TenderCountdown";

type Tender = {
  id: string;
  title: string;
  organization?: string | null;
  category?: string | null;
  region?: string | null;
  estimatedValue?: number | null;
  closesAt?: string | null;
  sourceUrl: string;
  daysLeft?: number | null;
  isThursday?: boolean;
  urgent?: boolean;
  matchScore?: number;
  requiresAmp?: boolean;
  plainSummary?: string;
  similarAwards?: {
    winnerName?: string | null;
    awardAmount?: number | null;
    awardDate?: string | null;
    title?: string | null;
    companyId?: string | null;
    companyNeq?: string | null;
    companyName?: string | null;
    contractStatus?: string | null;
  }[];
  amendmentCount?: number;
};

const CATEGORIES = ["Construction", "Services", "Fournitures", "Services professionnels"];

export default function MarchesQcClient() {
  const t = useTranslations("marches");
  const tc = useTranslations("compliance");
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [ampOnly, setAmpOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (region) params.set("region", region);
    if (q) params.set("q", q);
    if (ampOnly) params.set("ampOnly", "true");

    const res = await fetch(`/api/tenders?${params}`);
    const d = await res.json();
    setTenders(d.tenders ?? []);
    setLoading(false);
  }, [category, region, q, ampOnly]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const createAlert = async () => {
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: "marches_qc",
        filters: { category, region, q, ampOnly },
      }),
    });
    alert("Alerte MarchésQC créée!");
  };

  const createCompliance = async (tender: Tender) => {
    const winner = tender.similarAwards?.[0]?.winnerName;
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: winner ?? tender.organization ?? "Organisme SEAO",
        sourceType: "seao_tender_public",
        sourceUrl: tender.sourceUrl,
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
          <div className="mt-2">
            <FreshnessBadge datasetId="tenders" />
          </div>
        </div>
        <button
          onClick={createAlert}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium hover:bg-sky-400"
        >
          {t("createAlert")}
        </button>
      </div>

      <div className="mt-6 grid gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="text-xs text-slate-400">{t("search")}</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">{t("category")}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">{t("allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">{t("region")}</label>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Montréal, Capitale-Nationale..."
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={ampOnly}
              onChange={(e) => setAmpOnly(e.target.checked)}
              className="rounded border-slate-600"
            />
            AMP seulement
          </label>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void load()}
            className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            {t("applyFilters")}
          </button>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : tenders.length === 0 ? (
          <p className="text-slate-400">{t("noTenders")}</p>
        ) : (
          tenders.map((tender) => (
            <div
              key={tender.id}
              className={`rounded-xl border p-5 ${
                tender.urgent
                  ? "border-red-500/50 bg-red-950/20"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    {tender.urgent && (
                      <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                        {t("urgent")}
                      </span>
                    )}
                    {tender.isThursday && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        {t("thursdayClose")}
                      </span>
                    )}
                    {tender.matchScore !== undefined && (
                      <span className="rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300">
                        {t("matchScore")}: {tender.matchScore}%
                      </span>
                    )}
                    {tender.requiresAmp && (
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        AMP
                      </span>
                    )}
                    {(tender.amendmentCount ?? 0) > 0 && (
                      <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                        {t("amendments")} ({tender.amendmentCount})
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-white">{tender.title}</h2>
                  <p className="text-sm text-slate-400">
                    {tender.organization} · {tender.region} · {tender.category}
                  </p>
                  {tender.plainSummary && (
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-500">
                      {tender.plainSummary}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => createCompliance(tender)}
                    className="mt-2 text-xs text-sky-400 hover:text-sky-300"
                  >
                    {tc("createFromPermit")} (CASL) →
                  </button>
                  {tender.similarAwards && tender.similarAwards.length > 0 && (
                    <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-950/50 p-3">
                      <p className="text-xs font-medium text-slate-400">{t("similarAwards")}</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-500">
                        {tender.similarAwards.map((a, i) => (
                          <li key={i}>
                            {a.companyId ? (
                              <a
                                href={`/fr/partenaires-ca?q=${encodeURIComponent(a.companyName ?? a.winnerName ?? "")}`}
                                className="text-sky-400 hover:underline"
                              >
                                {a.companyName ?? a.winnerName ?? "—"}
                              </a>
                            ) : (
                              (a.winnerName ?? "—")
                            )}
                            {a.companyNeq ? ` (NEQ ${a.companyNeq})` : ""} —{" "}
                            {a.awardAmount
                              ? `${a.awardAmount.toLocaleString("fr-CA")} $`
                              : ""}
                            {a.contractStatus && (
                              <span className="ml-1 rounded bg-slate-700 px-1 text-[10px] text-slate-400">
                                {a.contractStatus}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <TenderCountdown
                  closesAt={tender.closesAt}
                  daysLeft={tender.daysLeft}
                  isThursday={tender.isThursday}
                  urgent={tender.urgent}
                  labels={{
                    days: t("days"),
                    closesIn: t("closesIn"),
                    thursday: t("thursdayClose"),
                  }}
                />
                <div className="text-right">
                  {tender.closesAt && (
                    <p className="text-sm text-slate-400">
                      {format(new Date(tender.closesAt), "d MMM yyyy", { locale: fr })}
                    </p>
                  )}
                  {tender.estimatedValue && (
                    <p className="mt-1 font-mono text-slate-300">
                      ~{tender.estimatedValue.toLocaleString("fr-CA")} $
                    </p>
                  )}
                  <a
                    href={tender.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-sky-400 hover:underline"
                  >
                    {t("viewSource")} →
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
