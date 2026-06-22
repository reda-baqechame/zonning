"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import FreshnessBadge from "@/components/FreshnessBadge";
import TenderCountdown from "@/components/TenderCountdown";
import { LeadCard } from "@/components/LeadCard";
import { createAlert } from "@/lib/alerts/create-alert";
import type { LeadSignal } from "@/lib/lead-signals";
import type { OpportunityDossier } from "@/lib/domain/quebec";
import type { TenderScoreResult } from "@/lib/tender-score";
import {
  PageHeader,
  Input,
  Select,
  FieldLabel,
  Button,
  useToast,
  FadeIn,
  EmptyState,
} from "@/components/ui";
import { FileSearch } from "lucide-react";

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
  score?: number;
  signals?: LeadSignal[];
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
  winProbability?: number;
  expectedValue?: number | null;
  winConfidence?: "low" | "medium" | "high";
  matchReasons?: { fr: string; en: string; positive: boolean }[];
  bidRecommendation?: {
    decision: "bid" | "consider" | "monitor" | "no-bid";
    labelFr: string;
    labelEn: string;
    rationaleFr: string;
    rationaleEn: string;
  };
  incumbent?: {
    distinctWinners: number;
    dominance: number;
    topIncumbents: { name: string; wins: number; avgAmount: number | null; avgOverrunPct: number | null }[];
  };
  ranking?: TenderScoreResult;
  opportunityDossier?: OpportunityDossier;
};

const DEFAULT_CATEGORIES = ["Construction", "Services", "Fournitures", "Services professionnels"];

export default function MarchesQcClient() {
  const t = useTranslations("marches");
  const c = useTranslations("common");
  const locale = useLocale();
  const { success, error: toastError } = useToast();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [standingOffers, setStandingOffers] = useState<Tender[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [complianceEntitled, setComplianceEntitled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("");
  const [region, setRegion] = useState("");
  const [q, setQ] = useState("");
  const [ampOnly, setAmpOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (region) params.set("region", region);
    if (q) params.set("q", q);
    if (ampOnly) params.set("ampOnly", "true");

    try {
      const res = await fetch(`/api/tenders?${params}`);
      const standingRes = await fetch("/api/tenders?standing=true");
      const d = await res.json();
      const standingData = await standingRes.json();
      if (!res.ok) {
        setLoadError(d.error ?? c("error"));
        setTenders([]);
        return;
      }
      setTenders(d.tenders ?? []);
      setStandingOffers(standingData.tenders ?? []);
      setCategories(d.categories?.length ? d.categories : DEFAULT_CATEGORIES);
      setComplianceEntitled(d.complianceEntitled ?? false);
    } catch {
      setLoadError(c("error"));
    } finally {
      setLoading(false);
    }
  }, [category, region, q, ampOnly, c]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const handleCreateAlert = async () => {
    const result = await createAlert({
      module: "marches_qc",
      filters: { category, region, q, ampOnly },
    });
    if (!result.ok) {
      toastError(result.error);
      return;
    }
    success(t("alertSuccess"));
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
      toastError(data.error ?? c("error"));
      return;
    }
    window.open(`/api/compliance?id=${data.record.id}`, "_blank");
  };

  const hasThursday = tenders.some((x) => x.isThursday);

  return (
    <FadeIn className="mx-auto max-w-7xl px-4 py-10">
      {hasThursday && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {t("thursdayBanner")}
        </div>
      )}
      <PageHeader
        title={t("title")}
        action={
          <div className="flex flex-col items-end gap-2">
            <FreshnessBadge datasetId="tenders" />
            <Button size="sm" onClick={() => void handleCreateAlert()}>
              {t("createAlert")}
            </Button>
          </div>
        }
      />

      {standingOffers.length > 0 && (
        <div className="mt-6 rounded-xl border border-violet-500/30 bg-violet-950/20 p-4">
          <h2 className="text-sm font-semibold text-violet-200">{t("standingOffers")}</h2>
          <p className="mt-1 text-xs text-slate-500">{t("standingOffersDesc")}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {standingOffers.slice(0, 6).map((s) => (
              <li key={s.id}>
                <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-violet-300">
                  {s.title}
                </a>
                {s.organization && (
                  <span className="text-slate-500"> — {s.organization}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 rounded-xl border border-line bg-surface-2 p-4 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <FieldLabel htmlFor="search">{t("search")}</FieldLabel>
          <Input
            id="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div>
          <FieldLabel htmlFor="category">{t("category")}</FieldLabel>
          <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("allCategories")}</option>
            {(categories.length ? categories : DEFAULT_CATEGORIES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="region">{t("region")}</FieldLabel>
          <Input
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Montréal, Capitale-Nationale..."
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={ampOnly}
              onChange={(e) => setAmpOnly(e.target.checked)}
              className="rounded border-line-strong"
            />
            AMP seulement
          </label>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void load()}
            className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm text-ink hover:bg-surface-hover"
          >
            {t("applyFilters")}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mt-4 rounded-lg border border-danger/40 bg-danger-soft p-4 text-sm text-danger-ink">
          {loadError}
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => void load()}>
            {c("retry")}
          </Button>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {loading ? (
          <p className="text-muted">{c("loading")}</p>
        ) : tenders.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="h-8 w-8" />}
            title={t("noTenders")}
            description={t("noTendersHint")}
          />
        ) : (
          tenders.map((tender) => (
            <div key={tender.id} className="space-y-2">
              <LeadCard
                locale={locale}
                complianceEnabled={complianceEntitled}
                onCompliance={() => createCompliance(tender)}
                item={{
                  kind: "tender",
                  id: tender.id,
                  score: tender.score ?? tender.matchScore ?? 50,
                  signals: tender.signals ?? [],
                  title: tender.title,
                  organization: tender.organization,
                  daysLeft: tender.daysLeft,
                  isThursday: tender.isThursday,
                  urgent: tender.urgent,
                  requiresAmp: tender.requiresAmp,
                  plainSummary: tender.plainSummary,
                  sourceUrl: tender.sourceUrl,
                  amendmentCount: tender.amendmentCount,
                  ranking: tender.ranking,
                  opportunityDossier: tender.opportunityDossier,
                }}
                countdown={
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
                }
              />
              {tender.winProbability != null && (
                <div className="grid gap-3 rounded-lg border border-slate-700/50 bg-slate-950/50 p-3 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-400">{t("winProbability")}</span>
                      <span className="font-semibold text-sky-300">{tender.winProbability}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                        style={{ width: `${tender.winProbability}%` }}
                      />
                    </div>
                    {tender.expectedValue != null && (
                      <p className="mt-1.5 text-xs text-slate-500">
                        {t("expectedValue")}: {tender.expectedValue.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")} $
                      </p>
                    )}
                    {tender.bidRecommendation && (
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          tender.bidRecommendation.decision === "bid"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : tender.bidRecommendation.decision === "consider"
                              ? "bg-sky-500/15 text-sky-300"
                              : tender.bidRecommendation.decision === "no-bid"
                                ? "bg-red-500/15 text-red-300"
                                : "bg-slate-700/40 text-slate-300"
                        }`}
                        title={locale === "fr" ? tender.bidRecommendation.rationaleFr : tender.bidRecommendation.rationaleEn}
                      >
                        {locale === "fr" ? tender.bidRecommendation.labelFr : tender.bidRecommendation.labelEn}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {tender.matchReasons && tender.matchReasons.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400">{t("whyFits")}</p>
                        <ul className="mt-1 space-y-0.5 text-xs">
                          {tender.matchReasons.slice(0, 4).map((r, i) => (
                            <li key={i} className={r.positive ? "text-emerald-300/90" : "text-amber-300/80"}>
                              {r.positive ? "✓" : "•"} {locale === "fr" ? r.fr : r.en}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tender.incumbent && tender.incumbent.topIncumbents.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          {t("incumbents")} · {tender.incumbent.distinctWinners}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                          {tender.incumbent.topIncumbents.slice(0, 2).map((inc, i) => (
                            <li key={i}>
                              {inc.name} — {inc.wins}× {inc.avgOverrunPct != null && inc.avgOverrunPct > 0
                                ? `(+${inc.avgOverrunPct}% ${t("overrun")})`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {tender.similarAwards && tender.similarAwards.length > 0 && (
                <div className="rounded-lg border border-line bg-surface-2 p-3">
                  <p className="text-xs font-medium text-muted">{t("similarAwards")}</p>
                  <ul className="mt-1 space-y-1 text-xs text-subtle">
                    {tender.similarAwards.map((a, i) => (
                      <li key={i}>
                        {a.companyName ?? a.winnerName ?? "—"}
                        {a.awardAmount
                          ? ` — ${a.awardAmount.toLocaleString("fr-CA")} $`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </FadeIn>
  );
}
