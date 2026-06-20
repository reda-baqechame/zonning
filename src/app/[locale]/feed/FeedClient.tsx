"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Settings } from "lucide-react";
import VerdictStamp from "@/components/VerdictStamp";
import { LeadCard } from "@/components/LeadCard";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import {
  ContractorBriefing,
  type TriageFilter,
} from "@/components/ContractorBriefing";
import {
  LeadPipelineEditor,
  type PipelineStage,
} from "@/components/LeadPipelineEditor";
import { intelAccessForPlan } from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { LeadSignal } from "@/lib/lead-signals";
import { filterItemsBySignal } from "@/lib/lead-signals";
import type { RuntimeDataMode } from "@/lib/data-mode";
import type { VerdictTier } from "@/lib/verdict/compute-verdict";
import type { PipelineScoreResult } from "@/lib/pipeline-score";
import type { TenderScoreResult } from "@/lib/tender-score";
import type { PermitDataQuality } from "@/lib/permits/quality";
import type { OpportunityDossier } from "@/lib/domain/quebec";
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
      opportunityDossier?: OpportunityDossier;
      saved?: boolean;
      savedNote?: string | null;
      savedStage?: PipelineStage | null;
      savedNextActionAt?: string | null;
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
        opportunityDossier?: OpportunityDossier;
      };
    }
  | {
      kind: "tender";
      id: string;
      score: number;
      signals: LeadSignal[];
      opportunityDossier?: OpportunityDossier;
      saved?: boolean;
      savedNote?: string | null;
      savedStage?: PipelineStage | null;
      savedNextActionAt?: string | null;
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
        opportunityDossier?: OpportunityDossier;
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
  const [tab, setTab] = useState("all");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState<{
    trades: string[];
    regions: string[];
    ampAuthorized?: boolean;
  } | null>(null);
  const [complianceEntitled, setComplianceEntitled] = useState(false);
  const [userPlan, setUserPlan] = useState<string>("FREE");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<
    "urgent" | "rbq" | "high_value" | "risks" | null
  >(null);
  const [triageFilter, setTriageFilter] = useState<TriageFilter>(null);
  const [visibleCount, setVisibleCount] = useState(25);
  const [verdictAddress, setVerdictAddress] = useState("");
  const [verdictBorough, setVerdictBorough] = useState("");
  const [verdictResult, setVerdictResult] = useState<{
    tier: VerdictTier;
    label: string;
    summary: string;
    slug: string;
  } | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  const [pipelineDrafts, setPipelineDrafts] = useState<
    Record<string, { note: string; stage: PipelineStage; nextActionAt: string }>
  >({});
  const [savingPipeline, setSavingPipeline] = useState<string | null>(null);

  const apiTab = tab === "watchlist" ? "watchlist" : "all";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/feed?tab=${apiTab}&locale=${locale}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? c("error"));
        setItems([]);
        return;
      }
      const loadedItems = (data.items ?? []) as FeedItem[];
      setItems(loadedItems);
      setPipelineDrafts(
        Object.fromEntries(
          loadedItems.map((item) => [
            `${item.kind}:${item.id}`,
            {
              note: item.savedNote ?? "",
              stage: item.savedStage ?? "new",
              nextActionAt: item.savedNextActionAt?.slice(0, 10) ?? "",
            },
          ]),
        ),
      );
      setProfile(data.profile ?? null);
      setComplianceEntitled(data.complianceEntitled ?? false);
      setUserPlan(data.plan ?? "FREE");
    } catch {
      setLoadError(c("error"));
    } finally {
      setLoading(false);
    }
  }, [apiTab, c, locale]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const toggleSave = async (item: FeedItem) => {
    const dossier = item.opportunityDossier ??
      (item.kind === "permit"
        ? item.permit.opportunityDossier
        : item.tender.opportunityDossier);
    const res = item.saved
      ? await fetch(`/api/leads/saved?kind=${item.kind}&itemId=${item.id}`, {
          method: "DELETE",
        })
      : await fetch("/api/leads/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: item.kind,
            itemId: item.id,
            stage: dossier?.triage.recommendedStage ?? "new",
            nextActionAt: dossier?.triage.actionBy ?? null,
          }),
        });
    if (!res.ok) {
      toastError(c("error"));
      return;
    }
    if (item.saved && tab === "watchlist") {
      setItems((current) =>
        current.filter(
          (candidate) =>
            candidate.kind !== item.kind || candidate.id !== item.id,
        ),
      );
    } else {
      setItems((current) =>
        current.map((candidate) =>
          candidate.kind === item.kind && candidate.id === item.id
            ? {
                ...candidate,
                saved: !item.saved,
                savedStage: item.saved
                  ? null
                  : (dossier?.triage.recommendedStage ?? "new"),
                savedNextActionAt: item.saved
                  ? null
                  : (dossier?.triage.actionBy ?? null),
              }
            : candidate,
        ),
      );
    }
    success(c("success"));
  };

  const permits = items.filter((i) => i.kind === "permit");
  const tenders = items.filter((i) => i.kind === "tender");
  const savedItems = items.filter((i) => i.saved);

  const savePipeline = async (item: FeedItem) => {
    const key = `${item.kind}:${item.id}`;
    const draft = pipelineDrafts[key] ?? {
      note: "",
      stage: "new" as const,
      nextActionAt: "",
    };
    setSavingPipeline(key);
    try {
      const res = await fetch("/api/leads/saved", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: item.kind,
          itemId: item.id,
          notes: draft.note,
          stage: draft.stage,
          nextActionAt: draft.nextActionAt
            ? `${draft.nextActionAt}T12:00:00.000Z`
            : null,
        }),
      });
      if (!res.ok) {
        toastError(t("noteSaveError"));
        return;
      }
      const savedNextActionAt = draft.nextActionAt
        ? `${draft.nextActionAt}T12:00:00.000Z`
        : null;
      setItems((current) =>
        current.map((candidate) =>
          candidate.kind === item.kind && candidate.id === item.id
            ? {
                ...candidate,
                savedNote: draft.note,
                savedStage: draft.stage,
                savedNextActionAt,
              }
            : candidate,
        ),
      );
      success(t("pipeline.saved"));
    } catch {
      toastError(t("noteSaveError"));
    } finally {
      setSavingPipeline(null);
    }
  };

  const displayed = useMemo(() => {
    let list: FeedItem[] =
      tab === "all"
        ? items
        : tab === "permits"
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
    if (triageFilter) {
      list = list.filter((item) => {
        const dossier = item.opportunityDossier ??
          (item.kind === "permit"
            ? item.permit.opportunityDossier
            : item.tender.opportunityDossier);
        return dossier?.triage.recommendation === triageFilter;
      });
    }
    return list;
  }, [tab, signalFilter, triageFilter, permits, tenders, savedItems, items]);

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
    { id: "all", label: t("tab.priority"), count: items.length },
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

  const briefing = useMemo(() => {
    const recommendation = (item: FeedItem) =>
      (item.opportunityDossier ??
        (item.kind === "permit"
          ? item.permit.opportunityDossier
          : item.tender.opportunityDossier))?.triage.recommendation;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return {
      actNow: items.filter((item) => recommendation(item) === "act_now").length,
      verifyFirst: items.filter((item) => recommendation(item) === "verify_first").length,
      watch: items.filter((item) => recommendation(item) === "watch").length,
      due: items.filter(
        (item) =>
          item.savedNextActionAt &&
          new Date(item.savedNextActionAt).getTime() <= today.getTime() &&
          !["won", "lost", "archived"].includes(item.savedStage ?? ""),
      ).length,
    };
  }, [items]);
  const emptyCopy =
    tab === "watchlist"
      ? { title: t("noWatchlist"), description: t("noWatchlistHint") }
      : tab === "tenders"
        ? { title: t("noTenders"), description: t("noTendersHint") }
        : { title: t("noPermits"), description: t("noPermitsHint") };

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
        onChange={(nextTab) => {
          setTab(nextTab);
          setVisibleCount(25);
          setTriageFilter(null);
        }}
        className="sticky top-[57px] z-40 bg-bg/95 py-2 backdrop-blur"
      />

      {tab === "all" ? (
        <ContractorBriefing
          actNow={briefing.actNow}
          verifyFirst={briefing.verifyFirst}
          watch={briefing.watch}
          due={briefing.due}
          activeFilter={triageFilter}
          onFilter={(filter) => {
            setTriageFilter(filter);
            setVisibleCount(25);
          }}
        />
      ) : null}

      {tab !== "verdict" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.id ?? "all"}
              type="button"
              onClick={() =>
                {
                  setSignalFilter(signalFilter === chip.id ? null : chip.id);
                  setVisibleCount(25);
                }
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
              title={emptyCopy.title}
              description={emptyCopy.description}
              action={
                <Link href="/settings">
                  <Button variant="secondary" size="sm">
                    {t("settings")}
                  </Button>
                </Link>
              }
            />
          ) : (
            displayed.slice(0, visibleCount).map((item) => {
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
                        opportunityDossier:
                          item.permit.opportunityDossier ??
                          item.opportunityDossier,
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
                        opportunityDossier:
                          item.tender.opportunityDossier ??
                          item.opportunityDossier,
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
                    <LeadPipelineEditor
                      id={noteKey}
                      stage={pipelineDrafts[noteKey]?.stage ?? "new"}
                      nextActionAt={pipelineDrafts[noteKey]?.nextActionAt ?? ""}
                      note={pipelineDrafts[noteKey]?.note ?? ""}
                      saving={savingPipeline === noteKey}
                      onStageChange={(stage) =>
                        setPipelineDrafts((current) => ({
                          ...current,
                          [noteKey]: {
                            ...(current[noteKey] ?? { note: "", nextActionAt: "" }),
                            stage,
                          },
                        }))
                      }
                      onDateChange={(nextActionAt) =>
                        setPipelineDrafts((current) => ({
                          ...current,
                          [noteKey]: {
                            ...(current[noteKey] ?? { note: "", stage: "new" }),
                            nextActionAt,
                          },
                        }))
                      }
                      onNoteChange={(note) =>
                        setPipelineDrafts((current) => ({
                          ...current,
                          [noteKey]: {
                            ...(current[noteKey] ?? {
                              stage: "new",
                              nextActionAt: "",
                            }),
                            note,
                          },
                        }))
                      }
                      onSave={() => void savePipeline(item)}
                    />
                  ) : null}
                </StaggerItem>
              );
            })
          )}
          {displayed.length > visibleCount ? (
            <div className="flex justify-center pt-2">
              <Button
                variant="secondary"
                onClick={() => setVisibleCount((count) => count + 25)}
              >
                {t("showMore", {
                  count: Math.min(25, displayed.length - visibleCount),
                })}
              </Button>
            </div>
          ) : null}
        </StaggerList>
      )}
    </FadeIn>
  );
}
