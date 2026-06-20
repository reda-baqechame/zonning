"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import VerdictStamp from "@/components/VerdictStamp";
import { LeadCard } from "@/components/LeadCard";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import MissedOpportunityBanner, {
  type FeedFomoMeta,
} from "@/components/MissedOpportunityBanner";
import LockedLeadTeasers from "@/components/LockedLeadTeasers";
import { intelAccessForPlan } from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { LeadSignal } from "@/lib/lead-signals";
import { filterItemsBySignal } from "@/lib/lead-signals";
import type { RuntimeDataMode } from "@/lib/data-mode";
import type { VerdictTier } from "@/lib/verdict/compute-verdict";
import type { PipelineScoreResult } from "@/lib/pipeline-score";
import type { TenderScoreResult } from "@/lib/tender-score";
import type { PermitDataQuality } from "@/lib/permits/quality";
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
      savedNote?: string | null;
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
        pipeline?: PipelineScoreResult;
        sourceUrl?: string;
        applicantName?: string | null;
        dataQuality?: PermitDataQuality;
        intelligence?: PropertyIntelligence | null;
      };
    }
  | {
      kind: "tender";
      id: string;
      score: number;
      signals: LeadSignal[];
      saved?: boolean;
      savedNote?: string | null;
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
        ranking?: TenderScoreResult;
      };
    };

export default function FeedClient({
  dataMode,
}: {
  dataMode: RuntimeDataMode;
}) {
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
    {
      id: string;
      kind: "permit" | "tender";
      label: string;
      borough?: string | null;
      score: number;
      valueLabel?: string;
    }[]
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
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  const apiTab = tab === "verdict" ? "permits" : tab;

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
      const loadedItems = (data.items ?? []) as FeedItem[];
      setItems(loadedItems);
      setNoteDrafts(
        Object.fromEntries(
          loadedItems.map((item) => [
            `${item.kind}:${item.id}`,
            item.savedNote ?? "",
          ]),
        ),
      );
      setProfile(data.profile ?? null);
      setComplianceEntitled(data.complianceEntitled ?? false);
      setUserPlan(data.plan ?? "FREE");
      setFomoMeta(data.meta ?? null);
      if (
        data.meta &&
        data.meta.plan !== "PRO" &&
        data.meta.plan !== "EQUIPE"
      ) {
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
    const res = item.saved
      ? await fetch(`/api/leads/saved?kind=${item.kind}&itemId=${item.id}`, {
          method: "DELETE",
        })
      : await fetch("/api/leads/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: item.kind, itemId: item.id }),
        });
    if (!res.ok) {
      toastError(c("error"));
      return;
    }
    success(c("success"));
    void load();
  };

  const permits = items.filter((i) => i.kind === "permit");
  const tenders = items.filter((i) => i.kind === "tender");
  const savedItems = items.filter((i) => i.saved);

  const saveNote = async (item: FeedItem) => {
    const key = `${item.kind}:${item.id}`;
    setSavingNote(key);
    try {
      const res = await fetch("/api/leads/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          itemId: item.id,
          notes: noteDrafts[key] ?? "",
        }),
      });
      if (!res.ok) {
        toastError(t("noteSaveError"));
        return;
      }
      success(t("noteSaved"));
    } catch {
      toastError(t("noteSaveError"));
    } finally {
      setSavingNote(null);
    }
  };

  const displayed = useMemo(() => {
    let list: FeedItem[] =
      tab === "permits"
        ? permits
        : tab === "tenders"
          ? tenders
          : tab === "watchlist"
            ? savedItems
            : [];
    if (signalFilter) {
      list = filterItemsBySignal(
        list.map((i) => ({ ...i, signals: i.signals })),
        signalFilter,
      );
    }
    return list;
  }, [tab, signalFilter, permits, tenders, savedItems]);

  const tradesLabel = profile?.trades?.length
    ? profile.trades.join(", ")
    : t("allTrades");
  const regionsLabel = profile?.regions?.length
    ? profile.regions.join(", ")
    : t("allRegions");

  const runVerdict = async () => {
    if (!verdictAddress.trim()) return;
    setVerdictLoading(true);
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: verdictAddress,
        borough: verdictBorough || undefined,
      }),
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
    <FadeIn className="mx-auto max-w-7xl px-4 py-8 text-ink">
      <div className="mb-4">
        <QuebecCoverageBar compact />
      </div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted shadow-sm transition hover:border-brand-border hover:text-brand"
          >
            <Settings className="h-4 w-4" />
            {t("settings")}
          </Link>
        }
      />
      <p className="-mt-4 mb-6 text-sm text-muted">
        {regionsLabel} · {tradesLabel}
      </p>
      {dataMode === "local" ? (
        <p className="-mt-3 mb-6 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          {t("localDataNotice")}
        </p>
      ) : null}

      <Tabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        className="sticky top-[57px] z-40 bg-bg/95 py-2 backdrop-blur"
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
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-muted hover:border-brand-border hover:text-brand"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {tab !== "verdict" && tab !== "watchlist" && fomoMeta && (
        <div className="mt-4">
          <MissedOpportunityBanner meta={fomoMeta} />
        </div>
      )}

      {loadError && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger-ink">
          {loadError}
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => void load()}
          >
            {c("retry")}
          </Button>
        </div>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : tab === "verdict" ? (
        <Card className="mt-6 space-y-4">
          <p className="text-sm text-muted">{t("verdictHint")}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="v-address">
                {t("addressPlaceholder")}
              </FieldLabel>
              <Input
                id="v-address"
                value={verdictAddress}
                onChange={(e) => setVerdictAddress(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="v-borough">
                {t("boroughPlaceholder")}
              </FieldLabel>
              <Input
                id="v-borough"
                value={verdictBorough}
                onChange={(e) => setVerdictBorough(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="success"
            onClick={runVerdict}
            disabled={verdictLoading}
          >
            {verdictLoading ? c("loading") : t("runVerdict")}
          </Button>
          {verdictResult && (
            <div className="space-y-4 border-t border-line pt-4">
              <VerdictStamp
                tier={verdictResult.tier}
                label={verdictResult.label}
                address={verdictAddress}
              />
              <p className="text-sm text-muted">{verdictResult.summary}</p>
              <Link
                href={`/verdict/${verdictResult.slug}`}
                className="text-sm text-brand"
              >
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
              description={
                tab === "watchlist" ? t("noWatchlistHint") : t("noPermitsHint")
              }
              action={
                <Link href="/settings">
                  <Button variant="secondary" size="sm">
                    {t("settings")}
                  </Button>
                </Link>
              }
            />
          ) : (
            displayed.map((item) => {
              const noteKey = `${item.kind}:${item.id}`;
              return (
                <StaggerItem key={noteKey}>
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
                        dataQuality: item.permit.dataQuality,
                      }}
                      saved={item.saved}
                      complianceEnabled={complianceEntitled}
                      onSave={() => void toggleSave(item)}
                      onCompliance={() => createCompliance(item.permit)}
                      intelligence={item.permit.intelligence}
                      intelAccess={intelAccess}
                      testData={dataMode === "local"}
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
                        ranking: item.tender.ranking,
                      }}
                      saved={item.saved}
                      onSave={() => void toggleSave(item)}
                      testData={dataMode === "local"}
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
                  {tab === "watchlist" ? (
                    <div className="mx-3 border-x border-b border-line bg-white px-4 pb-4 pt-3">
                      <FieldLabel htmlFor={`note-${item.kind}-${item.id}`}>
                        {t("watchlistNote")}
                      </FieldLabel>
                      <textarea
                        id={`note-${item.kind}-${item.id}`}
                        value={noteDrafts[noteKey] ?? ""}
                        maxLength={2000}
                        rows={2}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [noteKey]: event.target.value,
                          }))
                        }
                        placeholder={t("watchlistNotePlaceholder")}
                        className="mt-1 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
                      />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-subtle">
                          {(noteDrafts[noteKey] ?? "").length}/2000
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={savingNote === noteKey}
                          onClick={() => void saveNote(item)}
                        >
                          {savingNote === noteKey
                            ? c("loading")
                            : t("saveNote")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </StaggerItem>
              );
            })
          )}
          {tab !== "watchlist" &&
            fomoMeta &&
            fomoMeta.plan !== "PRO" &&
            fomoMeta.plan !== "EQUIPE" && (
              <LockedLeadTeasers teasers={lockedTeasers} />
            )}
        </StaggerList>
      )}
    </FadeIn>
  );
}
