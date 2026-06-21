"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, CheckCircle2, Clock3, RefreshCw, X } from "lucide-react";
import { CockpitSidebar } from "@/components/CockpitSidebar";
import { OpportunityDetailPanel } from "@/components/OpportunityDetailPanel";
import {
  OpportunityTable,
  type DecisionFilter,
  type SourceFilter,
} from "@/components/OpportunityTable";
import { Button, useToast } from "@/components/ui";
import type { RuntimeDataMode } from "@/lib/data-mode";
import {
  feedItemKey,
  getFeedDossier,
  getFeedLocation,
  getFeedTitle,
  type FeedItem,
} from "@/lib/feed";
import type { PipelineStage } from "@/lib/domain/quebec";

type PipelineDraft = {
  note: string;
  stage: PipelineStage;
  nextActionAt: string;
};

type ContractorProfile = {
  trades: string[];
  regions: string[];
  ampAuthorized?: boolean;
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
};

const PAGE_SIZE = 25;

export default function FeedClient({ dataMode }: { dataMode: RuntimeDataMode }) {
  const t = useTranslations("feed");
  const workspace = useTranslations("feed.workspace");
  const common = useTranslations("common");
  const locale = useLocale();
  const { error: toastError, success } = useToast();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [profile, setProfile] = useState<ContractorProfile | null>(null);
  const [userPlan, setUserPlan] = useState("FREE");
  const [complianceEntitled, setComplianceEntitled] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>(null);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pipelineDrafts, setPipelineDrafts] = useState<Record<string, PipelineDraft>>({});
  const [savingPipeline, setSavingPipeline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiTab = sourceFilter === "saved" ? "watchlist" : "all";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/feed?tab=${apiTab}&locale=${locale}`);
      const data = await response.json();
      if (!response.ok) {
        setItems([]);
        setLoadError(data.error ?? common("error"));
        return;
      }
      const loaded = (data.items ?? []) as FeedItem[];
      setItems(loaded);
      setProfile(data.profile ?? null);
      setUserPlan(data.plan ?? "FREE");
      setComplianceEntitled(data.complianceEntitled ?? false);
      setGeneratedAt(data.generatedAt ?? null);
      setPipelineDrafts(
        Object.fromEntries(
          loaded.map((item) => [
            feedItemKey(item),
            {
              note: item.savedNote ?? "",
              stage: item.savedStage ?? "new",
              nextActionAt: item.savedNextActionAt?.slice(0, 10) ?? "",
            },
          ]),
        ),
      );
      setSelectedKey((current) =>
        loaded.some((item) => feedItemKey(item) === current)
          ? current
          : loaded[0]
            ? feedItemKey(loaded[0])
            : null,
      );
    } catch {
      setItems([]);
      setLoadError(common("error"));
    } finally {
      setLoading(false);
    }
  }, [apiTab, common, locale]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase(locale);
    return items.filter((item) => {
      if (sourceFilter === "permit" && item.kind !== "permit") return false;
      if (sourceFilter === "tender" && item.kind !== "tender") return false;
      if (sourceFilter === "saved" && !item.saved) return false;
      const recommendation = getFeedDossier(item)?.triage.recommendation;
      if (decisionFilter && recommendation !== decisionFilter) return false;
      if (!query) return true;
      const searchText = [
        getFeedTitle(item),
        getFeedLocation(item),
        item.kind === "permit"
          ? `${item.permit.address} ${item.permit.city ?? ""}`
          : `${item.tender.organization ?? ""} ${item.tender.region ?? ""}`,
      ]
        .join(" ")
        .toLocaleLowerCase(locale);
      return searchText.includes(query);
    });
  }, [decisionFilter, items, locale, search, sourceFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleItems = filteredItems.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const selectedItem =
    filteredItems.find((item) => feedItemKey(item) === selectedKey) ??
    visibleItems[0] ??
    null;

  const summary = useMemo(() => {
    const now = generatedAt ? new Date(generatedAt).getTime() : 0;
    const nextWeek = now + 7 * 86_400_000;
    return {
      analyzed: items.length,
      verify: items.filter(
        (item) => getFeedDossier(item)?.triage.recommendation === "verify_first",
      ).length,
      due: items.filter((item) => {
        if (!item.savedNextActionAt) return false;
        const actionAt = new Date(item.savedNextActionAt).getTime();
        return (
          actionAt <= nextWeek &&
          !["won", "lost", "archived"].includes(item.savedStage ?? "")
        );
      }).length,
    };
  }, [generatedAt, items]);

  const changeSourceFilter = (filter: SourceFilter) => {
    setSourceFilter(filter);
    setPage(1);
    setDecisionFilter(null);
  };

  const changeDecisionFilter = (filter: DecisionFilter) => {
    setDecisionFilter(filter);
    setPage(1);
  };

  const toggleSave = async (item: FeedItem) => {
    const dossier = getFeedDossier(item);
    const response = item.saved
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
    if (!response.ok) {
      toastError(common("error"));
      return;
    }

    if (item.saved && sourceFilter === "saved") {
      setItems((current) =>
        current.filter((candidate) => feedItemKey(candidate) !== feedItemKey(item)),
      );
      setSelectedKey(null);
    } else {
      const stage = dossier?.triage.recommendedStage ?? "new";
      const nextActionAt = dossier?.triage.actionBy ?? null;
      setItems((current) =>
        current.map((candidate) =>
          feedItemKey(candidate) === feedItemKey(item)
            ? {
                ...candidate,
                saved: !item.saved,
                savedStage: item.saved ? null : stage,
                savedNextActionAt: item.saved ? null : nextActionAt,
              }
            : candidate,
        ),
      );
      if (!item.saved) {
        setPipelineDrafts((current) => ({
          ...current,
          [feedItemKey(item)]: {
            note: "",
            stage,
            nextActionAt: nextActionAt?.slice(0, 10) ?? "",
          },
        }));
      }
    }
    success(item.saved ? workspace("removedFromPipeline") : workspace("addedToPipeline"));
  };

  const savePipeline = async (item: FeedItem) => {
    const key = feedItemKey(item);
    const draft = pipelineDrafts[key] ?? {
      note: "",
      stage: "new" as const,
      nextActionAt: "",
    };
    setSavingPipeline(key);
    try {
      const response = await fetch("/api/leads/saved", {
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
      if (!response.ok) {
        toastError(t("noteSaveError"));
        return;
      }
      setItems((current) =>
        current.map((candidate) =>
          feedItemKey(candidate) === key
            ? {
                ...candidate,
                savedNote: draft.note,
                savedStage: draft.stage,
                savedNextActionAt: draft.nextActionAt
                  ? `${draft.nextActionAt}T12:00:00.000Z`
                  : null,
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

  const createCompliance = async (item: FeedItem) => {
    if (item.kind !== "permit") return;
    const response = await fetch("/api/compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: item.permit.applicantName ?? "Demandeur permis",
        sourceType: "permit_public_registry",
        sourceUrl: item.permit.sourceUrl,
      }),
    });
    const data = await response.json();
    if (response.ok) window.open(`/api/compliance?id=${data.record.id}`, "_blank");
    else toastError(data.error ?? common("error"));
  };

  const profileLabel = [
    profile?.trades?.slice(0, 3).join(", "),
    profile?.regions?.slice(0, 2).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const syncedLabel = generatedAt
    ? new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(generatedAt))
    : null;

  return (
    <div data-cockpit-workspace className="min-h-screen bg-white text-ink lg:flex">
      <CockpitSidebar plan={userPlan} user={profile} />
      <div className="min-w-0 flex-1 xl:grid xl:grid-cols-[minmax(0,1fr)_410px]">
        <main className="min-w-0 bg-[#f7f9fc] p-3 sm:p-4 lg:p-5">
          <header className="mb-4 border-b border-line pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">{workspace("title")}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <Building2 className="h-4 w-4" />
                    {profile?.companyName || profile?.name || workspace("yourCompany")}
                  </span>
                  {profileLabel ? <span>{workspace("profileLabel", { value: profileLabel })}</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {syncedLabel ? workspace("generatedAt", { time: syncedLabel }) : workspace("loadingData")}
              </div>
            </div>
            {dataMode === "local" ? (
              <p className="mt-3 border-l-2 border-warning bg-warning-soft px-3 py-2 text-xs text-warning-ink">
                {t("localDataNotice")}
              </p>
            ) : null}
          </header>

          <section className="mb-4 grid border border-line bg-white sm:grid-cols-3" aria-label={workspace("summaryTitle")}>
            <div className="flex items-center gap-3 border-b border-line px-4 py-4 sm:border-b-0 sm:border-r">
              <RefreshCw className="h-5 w-5 text-subtle" strokeWidth={1.6} />
              <div>
                <p className="tabular-nums text-2xl font-semibold text-ink">{summary.analyzed}</p>
                <p className="text-xs text-muted">{workspace("signalsAnalyzed")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-line px-4 py-4 sm:border-b-0 sm:border-r">
              <Clock3 className="h-5 w-5 text-warning" strokeWidth={1.6} />
              <div>
                <p className="tabular-nums text-2xl font-semibold text-ink">{summary.verify}</p>
                <p className="text-xs text-muted">{workspace("needVerification")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <CheckCircle2 className="h-5 w-5 text-brand" strokeWidth={1.6} />
              <div>
                <p className="tabular-nums text-2xl font-semibold text-ink">{summary.due}</p>
                <p className="text-xs text-muted">{workspace("followupsDue")}</p>
              </div>
            </div>
          </section>

          {loadError ? (
            <div className="mb-4 flex items-center justify-between gap-3 border border-danger/30 bg-danger-soft p-3 text-sm text-danger-ink">
              {loadError}
              <Button variant="secondary" size="sm" onClick={() => void load()}>{common("retry")}</Button>
            </div>
          ) : null}

          {loading ? (
            <div className="animate-pulse border border-line bg-white">
              <div className="h-24 border-b border-line bg-surface-2" />
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="h-[74px] border-b border-line bg-white" />
              ))}
            </div>
          ) : filteredItems.length ? (
            <>
              <OpportunityTable
                items={visibleItems}
                selectedKey={selectedItem ? feedItemKey(selectedItem) : null}
                locale={locale}
                sourceFilter={sourceFilter}
                decisionFilter={decisionFilter}
                search={search}
                onSourceFilter={changeSourceFilter}
                onDecisionFilter={changeDecisionFilter}
                onSearch={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                onSelect={(item) => {
                  setSelectedKey(feedItemKey(item));
                  setDetailOpen(true);
                }}
              />
              <div className="flex items-center justify-between border-x border-b border-line bg-white px-4 py-3 text-xs text-muted">
                <span>
                  {workspace("pageRange", {
                    from: (safePage - 1) * PAGE_SIZE + 1,
                    to: Math.min(safePage * PAGE_SIZE, filteredItems.length),
                    total: filteredItems.length,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    {workspace("previous")}
                  </Button>
                  <span className="grid h-8 min-w-8 place-items-center rounded-md border border-brand text-brand">
                    {safePage}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  >
                    {workspace("next")}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="border border-line bg-white p-10 text-center">
              <h2 className="text-base font-semibold text-ink">{workspace("emptyTitle")}</h2>
              <p className="mt-2 text-sm text-muted">{workspace("emptyDescription")}</p>
            </div>
          )}
        </main>

        <div className="hidden min-w-0 bg-[#f7f9fc] p-2 xl:block xl:border-l xl:border-line">
          <OpportunityDetailPanel
            item={selectedItem}
            locale={locale}
            draft={selectedItem ? pipelineDrafts[feedItemKey(selectedItem)] : undefined}
            saving={selectedItem ? savingPipeline === feedItemKey(selectedItem) : false}
            complianceEnabled={complianceEntitled}
            onToggleSave={(item) => void toggleSave(item)}
            onCompliance={(item) => void createCompliance(item)}
            onDraftChange={(draft) => {
              if (!selectedItem) return;
              setPipelineDrafts((current) => ({
                ...current,
                [feedItemKey(selectedItem)]: draft,
              }));
            }}
            onSavePipeline={(item) => void savePipeline(item)}
          />
        </div>
      </div>

      {detailOpen && selectedItem ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#f7f9fc] p-2 xl:hidden">
          <div className="sticky top-0 z-10 mb-2 flex h-12 items-center justify-between border border-line bg-white px-3">
            <p className="text-sm font-semibold text-ink">{workspace("dossierTitle")}</p>
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-hover"
              aria-label={workspace("closeDossier")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <OpportunityDetailPanel
            item={selectedItem}
            locale={locale}
            draft={pipelineDrafts[feedItemKey(selectedItem)]}
            saving={savingPipeline === feedItemKey(selectedItem)}
            complianceEnabled={complianceEntitled}
            onToggleSave={(item) => void toggleSave(item)}
            onCompliance={(item) => void createCompliance(item)}
            onDraftChange={(draft) =>
              setPipelineDrafts((current) => ({
                ...current,
                [feedItemKey(selectedItem)]: draft,
              }))
            }
            onSavePipeline={(item) => void savePipeline(item)}
          />
        </div>
      ) : null}
    </div>
  );
}
