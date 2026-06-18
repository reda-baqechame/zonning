"use client";

import { useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import VerdictStamp from "@/components/VerdictStamp";
import type { VerdictTier } from "@/lib/verdict/compute-verdict";

type PermitItem = {
  id: string;
  address: string;
  borough?: string | null;
  permitType: string;
  estimatedCost?: number | null;
  pipelineScore?: number;
  summaryFr?: string | null;
  summaryEn?: string | null;
  rbqFit: { eligible: boolean; score: number };
  sourceUrl?: string;
  applicantName?: string | null;
};

type TenderItem = {
  id: string;
  title: string;
  organization?: string | null;
  closesAt?: string | null;
  daysLeft?: number | null;
  isThursday?: boolean;
  urgent?: boolean;
  matchScore?: number;
  requiresAmp?: boolean;
  plainSummary?: string;
  sourceUrl: string;
};

type Profile = {
  trades?: string | null;
  regions?: string | null;
  ampAuthorized?: boolean;
};

export default function FeedClient() {
  const t = useTranslations("feed");
  const locale = useLocale();
  const [tab, setTab] = useState<"permits" | "tenders" | "verdict">("permits");
  const [permits, setPermits] = useState<PermitItem[]>([]);
  const [tenders, setTenders] = useState<TenderItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verdictAddress, setVerdictAddress] = useState("");
  const [verdictBorough, setVerdictBorough] = useState("");
  const [verdictResult, setVerdictResult] = useState<{
    tier: VerdictTier;
    label: string;
    summary: string;
    slug: string;
  } | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, tRes, uRes] = await Promise.all([
      fetch("/api/permits?sort=pipeline&days=90"),
      fetch("/api/tenders"),
      fetch("/api/user/settings"),
    ]);
    const pData = await pRes.json();
    const tData = await tRes.json();
    const uData = uRes.ok ? await uRes.json() : { user: null };
    setPermits(pData.permits ?? []);
    setTenders(tData.tenders ?? []);
    setProfile(uData.user);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const tradesLabel = profile?.trades
    ? JSON.parse(profile.trades).join(", ")
    : t("allTrades");
  const regionsLabel = profile?.regions
    ? JSON.parse(profile.regions).join(", ")
    : t("allRegions");

  const runVerdict = async () => {
    if (!verdictAddress.trim()) return;
    setVerdictLoading(true);
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: verdictAddress, borough: verdictBorough || undefined }),
    });
    const data = await res.json();
    setVerdictLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Erreur");
      return;
    }
    const r = data.report;
    setVerdictResult({
      tier: r.tier as VerdictTier,
      label: locale === "fr" ? r.summaryFr?.split(".")[0] ?? r.tier : r.summaryEn?.split(".")[0] ?? r.tier,
      summary: locale === "fr" ? r.summaryFr : r.summaryEn,
      slug: r.shareSlug,
    });
  };

  const createCompliance = async (p: PermitItem) => {
    const res = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: p.applicantName ?? "Demandeur permis",
        sourceType: "permit_public_registry",
        sourceUrl: p.sourceUrl,
      }),
    });
    const data = await res.json();
    if (res.ok) window.open(`/api/compliance?id=${data.record.id}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {regionsLabel} · {tradesLabel}
          </p>
        </div>
        <Link href="/settings" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:border-sky-500">
          {t("settings")}
        </Link>
      </div>

      <div className="mt-6 flex gap-2 border-b border-slate-800 pb-2">
        {(["permits", "tenders", "verdict"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === key ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t(`tab.${key}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-8 text-slate-400">{t("loading")}</p>
      ) : tab === "permits" ? (
        <div className="mt-6 space-y-4">
          {permits.length === 0 ? (
            <p className="text-slate-400">{t("noPermits")}</p>
          ) : (
            permits.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-white">{p.permitType}</p>
                    <p className="text-sm text-slate-400">
                      {p.address} · {p.borough}
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      {(locale === "fr" ? p.summaryFr : p.summaryEn) ||
                        `${p.permitType} · ${p.borough ?? ""}`}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {p.pipelineScore != null && (
                      <p className="text-sky-300">
                        Pipeline <strong>{p.pipelineScore}</strong>
                      </p>
                    )}
                    <p className={p.rbqFit.eligible ? "text-emerald-400" : "text-amber-400"}>
                      RBQ {p.rbqFit.eligible ? "OK" : "—"} ({p.rbqFit.score})
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href="/chantier-radar" className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
                    {t("map")}
                  </Link>
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="rounded bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700">
                    {t("source")}
                  </a>
                  <button onClick={() => createCompliance(p)} className="rounded bg-violet-900/50 px-3 py-1 text-xs text-violet-300 hover:bg-violet-800/50">
                    CASL
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === "tenders" ? (
        <div className="mt-6 space-y-4">
          {tenders.map((tender) => (
            <div
              key={tender.id}
              className={`rounded-xl border p-4 ${
                tender.urgent ? "border-red-500/40 bg-red-950/20" : "border-slate-800 bg-slate-900/40"
              }`}
            >
              <p className="font-semibold text-white">{tender.title}</p>
              <p className="text-sm text-slate-400">{tender.organization}</p>
              <p className="mt-2 text-sm text-slate-300">{tender.plainSummary}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {tender.daysLeft != null && (
                  <span className={tender.urgent ? "text-red-300" : "text-slate-400"}>
                    {t("closesIn")} {tender.daysLeft}j
                    {tender.isThursday && ` · ${t("thursday")}`}
                  </span>
                )}
                {tender.matchScore != null && (
                  <span className="text-sky-300">{t("match")} {tender.matchScore}</span>
                )}
                {tender.requiresAmp && !profile?.ampAuthorized && (
                  <span className="text-amber-400">{t("ampRequired")}</span>
                )}
              </div>
              <a href={tender.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-sky-400">
                SEAO →
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-slate-400">{t("verdictHint")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={verdictAddress}
              onChange={(e) => setVerdictAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              value={verdictBorough}
              onChange={(e) => setVerdictBorough(e.target.value)}
              placeholder={t("boroughPlaceholder")}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={runVerdict}
            disabled={verdictLoading}
            className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {verdictLoading ? "..." : t("runVerdict")}
          </button>
          {verdictResult && (
            <div className="space-y-4">
              <VerdictStamp tier={verdictResult.tier} label={verdictResult.label} address={verdictAddress} />
              <p className="text-sm text-slate-300">{verdictResult.summary}</p>
              <Link href={`/verdict/${verdictResult.slug}`} className="text-sm text-sky-400">
                {t("shareLink")} →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
