"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import VerdictStamp from "@/components/VerdictStamp";
import { LeadCard } from "@/components/LeadCard";
import MarketPulseBar from "@/components/MarketPulseBar";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import MissedOpportunityBanner, {
  type FeedFomoMeta,
} from "@/components/MissedOpportunityBanner";
import LockedLeadTeasers from "@/components/LockedLeadTeasers";
import { intelAccessForPlan } from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { LeadSignal } from "@/lib/lead-signals";
import { filterItemsBySignal } from "@/lib/lead-signals";
import type { VerdictTier } from "@/lib/verdict/compute-verdict";
import {
  PageHeader,
  Tabs,
  SkeletonList,
  EmptyState,
  Card,
  Input,
  FieldLabel,
  Button,
  useToast,
  FadeIn,
  StaggerList,
  StaggerItem,
} from "@/components/ui";

type FeedItem =
  | {
      kind: "permit";
      id: string;
      score: number;
      signals: LeadSignal[];
      saved?: boolean;
      permit: {
        id: string;
        address: string;
        borough?: string | null;
        permitType: string;
        estimatedCost?: number | null;
        issueDate?: string | null;
        pipelineScore?: number;
        summaryFr?: string | null;
        summaryEn?: string | null;
        rbqFit: { eligible: boolean; score: number };
        pipeline?: {
          breakdown?: {
            rbqFit: number;
            costFit: number;
            competition: number;
            intelligence: number;
            zoning: number;
          };
        };
        sourceUrl?: string;
        applicantName?: string | null;
        intelligence?: PropertyIntelligence | null;
      };
    }
  | {
      kind: "tender";
      id: string;
      score: number;
      signals: LeadSignal[];
      saved?: boolean;
      tender: {
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
        amendmentCount?: number;
      };
    };

export default function FeedClient() {
  const t = useTranslations("feed");
  const c = useTranslations("common");
  const locale = useLocale();
  const { error: toastError, success } = useToast();
  const [tab, setTab] = useState("permits");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState<{
    trades: string[];
    regions: string[];
    ampAuthorized?: boolean;
  } | null>(null);
  const [complianceEntitled, setComplianceEntitled] = useState(false);
  const [fomoMeta, setFomoMeta] = useState<FeedFomoMeta | null>(null);
  const [lockedTeasers, setLockedTeasers] = useState<
    { id: string; kind: "permit" | "tender"; label: string; borough?: string | null; score: number; valueLabel?: string }[]
  >([]);
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<
    "urgent" | "rbq" | "high_value" | "risks" | null
  >(null);
  const [verdictAddress, setVerdictAddress] = useState("");
  const [verdictBorough, setVerdictBorough] = useState("");
  const [verdictResult, setVerdictResult] = useState<{
    tier: VerdictTier;
    label: string;
    summary: string;
    slug: string;
  } | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);

  const apiTab = tab === "watchlist" ? "all" : tab === "verdict" ? "permits" : tab;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/feed?tab=${apiTab}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? c("error"));
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
      setProfile(data.profile ?? null);
      setComplianceEntitled(data.complianceEntitled ?? false);
      setUserPlan(data.plan ?? "FREE");
      setFomoMeta(data.meta ?? null);
      if (data.meta && data.meta.plan !== "PRO" && data.meta.plan !== "EQUIPE") {
        fetch("/api/stats/preview")
          .then((r) => r.json())
          .then((d) => setLockedTeasers(d.leads ?? []))
          .catch(() => {});
      } else {
        setLockedTeasers([]);
      }
    } catch {
      setLoadError(c("error"));
    } finally {
      setLoading(false);
    }
  }, [apiTab, c]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const toggleSave = async (item: FeedItem) => {
    if (item.saved) {
      await fetch(
        `/api/leads/saved?kind=${item.kind}&itemId=${item.id}`,
        { method: "DELETE" }
      );
    } else {
      const res = await fetch("/api/leads/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, itemId: item.id }),
      });
      if (!res.ok) {
        toastError(c("error"));
        return;
      }
    }
    success(c("success"));
    void load();
  };

  const permits = items.filter((i) => i.kind === "permit");
  const tenders = items.filter((i) => i.kind === "tender");
  const savedItems = items.filter((i) => i.saved);

  const displayed = useMemo(() => {
    let list: FeedItem[] =
      tab === "permits" ? permits : tab === "tenders" ? tenders : tab === "watchlist" ? savedItems : [];
    if (signalFilter) {
      list = filterItemsBySignal(
        list.map((i) => ({ ...i, signals: i.signals })),
        signalFilter
      );
    }
    return list;
  }, [tab, signalFilter, permits, tenders, savedItems]);

  const tradesLabel =
    profile?.trades?.length ? profile.trades.join(", ") : t("allTrades");
  const regionsLabel =
    profile?.regions?.length ? profile.regions.join(", ") : t("allRegions");

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
      toastError(data.error ?? c("error"));
      return;
    }
    const r = data.report;
    setVerdictResult({
      tier: r.tier as VerdictTier,
      label:
        locale === "fr"
          ? (r.summaryFr?.split(".")[0] ?? r.tier)
          : (r.summaryEn?.split(".")[0] ?? r.tier),
      summary: locale === "fr" ? r.summaryFr : r.summaryEn,
      slug: r.shareSlug,
    });
  };

  const createCompliance = async (p: {
    applicantName?: string | null;
    sourceUrl?: string;
  }) => {
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
    else toastError(data.error ?? c("error"));
  };

  const intelAccess = intelAccessForPlan(userPlan);

  const tabs = [
    { id: "permits", label: t("tab.permits"), count: permits.length },
    { id: "tenders", label: t("tab.tenders"), count: tenders.length },
    { id: "watchlist", label: t("tab.watchlist"), count: savedItems.length },
    { id: "verdict", label: t("tab.verdict") },
  ];

  const filterChips: { id: typeof signalFilter; label: string }[] = [
    { id: "urgent", label: t("filterUrgent") },
    { id: "rbq", label: t("filterRbq") },
    { id: "high_value", label: t("filterHighValue") },
    { id: "risks", label: t("filterRisks") },
  ];

  return (
    <FadeIn className="mx-auto max-w-4xl px-4 py-8">
      <MarketPulseBar compact />
      <div className="mb-4">
        <QuebecCoverageBar compact />
      </div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-sky-500 hover:text-white"
          >
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Link>
        }
      />
      <p className="-mt-4 mb-6 text-sm text-slate-500">
        {regionsLabel} · {tradesLabel}
      </p>

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        className="sticky top-[57px] z-40 bg-slate-950/95 py-2 backdrop-blur"
      />

      {tab !== "verdict" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.id ?? "all"}
              type="button"
              onClick={() =>
                setSignalFilter(signalFilter === chip.id ? null : chip.id)
              }
              className={`rounded-full px-3 py-1 text-xs ${
                signalFilter === chip.id
                  ? "bg-sky-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {tab !== "verdict" && fomoMeta && (
        <div className="mt-4">
          <MissedOpportunityBanner meta={fomoMeta} />
        </div>
      )}

      {loadError && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
          {loadError}
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => void load()}>
            {c("retry")}
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : tab === "verdict" ? (
        <Card className="mt-6 space-y-4">
          <p className="text-sm text-slate-400">{t("verdictHint")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="v-address">{t("addressPlaceholder")}</FieldLabel>
              <Input
                id="v-address"
                value={verdictAddress}
                onChange={(e) => setVerdictAddress(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="v-borough">{t("boroughPlaceholder")}</FieldLabel>
              <Input
                id="v-borough"
                value={verdictBorough}
                onChange={(e) => setVerdictBorough(e.target.value)}
              />
            </div>
          </div>
          <Button variant="success" onClick={runVerdict} disabled={verdictLoading}>
            {verdictLoading ? c("loading") : t("runVerdict")}
          </Button>
          {verdictResult && (
            <div className="space-y-4 border-t border-slate-800 pt-4">
              <VerdictStamp
                tier={verdictResult.tier}
                label={verdictResult.label}
                address={verdictAddress}
              />
              <p className="text-sm text-slate-300">{verdictResult.summary}</p>
              <Link href={`/verdict/${verdictResult.slug}`} className="text-sm text-sky-400">
                {t("shareLink")} →
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <StaggerList className="mt-6 space-y-4">
          {displayed.length === 0 ? (
            <EmptyState
              title={tab === "watchlist" ? t("noWatchlist") : t("noPermits")}
              description={t("noPermitsHint")}
              action={
                <Link href="/settings">
                  <Button variant="secondary" size="sm">
                    {t("settings")}
                  </Button>
                </Link>
              }
            />
          ) : (
            displayed.map((item) => (
              <StaggerItem key={`${item.kind}-${item.id}`}>
                {item.kind === "permit" ? (
                  <LeadCard
                    locale={locale}
                    item={{
                      kind: "permit",
                      id: item.id,
                      score: item.score,
                      signals: item.signals,
                      permitType: item.permit.permitType,
                      address: item.permit.address,
                      borough: item.permit.borough,
                      estimatedCost: item.permit.estimatedCost,
                      issueDate: item.permit.issueDate,
                      summaryFr: item.permit.summaryFr,
                      summaryEn: item.permit.summaryEn,
                      rbqFit: item.permit.rbqFit,
                      pipeline: item.permit.pipeline,
                      sourceUrl: item.permit.sourceUrl,
                      applicantName: item.permit.applicantName,
                    }}
                    saved={item.saved}
                    complianceEnabled={complianceEntitled}
                    onSave={() => void toggleSave(item)}
                    onCompliance={() => createCompliance(item.permit)}
                    intelligence={item.permit.intelligence}
                    intelAccess={intelAccess}
                  />
                ) : (
                  <LeadCard
                    locale={locale}
                    item={{
                      kind: "tender",
                      id: item.id,
                      score: item.score,
                      signals: item.signals,
                      title: item.tender.title,
                      organization: item.tender.organization,
                      daysLeft: item.tender.daysLeft,
                      isThursday: item.tender.isThursday,
                      urgent: item.tender.urgent,
                      requiresAmp: item.tender.requiresAmp,
                      plainSummary: item.tender.plainSummary,
                      sourceUrl: item.tender.sourceUrl,
                      amendmentCount: item.tender.amendmentCount,
                    }}
                    saved={item.saved}
                    onSave={() => void toggleSave(item)}
                    countdown={
                      item.tender.daysLeft != null ? (
                        <p
                          className={`mt-2 text-xs ${item.tender.urgent ? "text-red-300" : "text-slate-400"}`}
                        >
                          {t("closesIn")} {item.tender.daysLeft}j
                          {item.tender.isThursday && ` · ${t("thursday")}`}
                        </p>
                      ) : undefined
                    }
                  />
                )}
              </StaggerItem>
            ))
          )}
          {fomoMeta && fomoMeta.plan !== "PRO" && fomoMeta.plan !== "EQUIPE" && (
            <LockedLeadTeasers teasers={lockedTeasers} />
          )}
        </StaggerList>
      )}
    </FadeIn>
  );
}
