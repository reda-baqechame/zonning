"use client";

import {
  ArrowUp,
  CircleAlert,
  Eye,
  Minus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCad } from "@/lib/format-cad";
import {
  feedItemKey,
  getFeedDossier,
  getFeedLocation,
  getFeedTitle,
  type FeedItem,
} from "@/lib/feed";
import type { OpportunityDossier } from "@/lib/domain/quebec";
import { cn } from "@/lib/cn";

export type SourceFilter = "all" | "permit" | "tender" | "thursday" | "saved";
export type DecisionFilter =
  | OpportunityDossier["triage"]["recommendation"]
  | null;

function decisionIcon(recommendation: DecisionFilter) {
  if (recommendation === "act_now") return ArrowUp;
  if (recommendation === "verify_first") return CircleAlert;
  if (recommendation === "watch") return Eye;
  return Minus;
}

function decisionTone(recommendation: DecisionFilter) {
  if (recommendation === "act_now") return "text-success-ink";
  if (recommendation === "verify_first") return "text-warning-ink";
  if (recommendation === "watch") return "text-brand";
  return "text-subtle";
}

function deadline(item: FeedItem, locale: string) {
  if (item.kind === "permit") return null;
  if (!item.tender.closesAt) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(item.tender.closesAt));
}

function value(item: FeedItem, locale: string) {
  const amount =
    item.kind === "permit"
      ? item.permit.estimatedCost
      : item.tender.estimatedValue;
  return amount ? formatCad(amount, locale) : null;
}

function proofCount(item: FeedItem, dossier?: OpportunityDossier) {
  let count = dossier?.siteIntelligence?.confirmedFacts?.length ?? 0;
  if (item.kind === "permit" && item.permit.dataQuality?.officialSource) count += 1;
  if (item.signals.some((signal) => signal.id === "rbq_eligible")) count += 1;
  if (item.kind === "tender") count += 1;
  return count;
}

export function OpportunityTable({
  items,
  selectedKey,
  locale,
  sourceFilter,
  decisionFilter,
  search,
  onSourceFilter,
  onDecisionFilter,
  onSearch,
  onSelect,
}: {
  items: FeedItem[];
  selectedKey?: string | null;
  locale: string;
  sourceFilter: SourceFilter;
  decisionFilter: DecisionFilter;
  search: string;
  onSourceFilter: (filter: SourceFilter) => void;
  onDecisionFilter: (filter: DecisionFilter) => void;
  onSearch: (value: string) => void;
  onSelect: (item: FeedItem) => void;
}) {
  const t = useTranslations("feed.workspace");
  const feed = useTranslations("feed");
  const sourceFilters: SourceFilter[] = ["all", "permit", "tender", "thursday", "saved"];
  const decisions: Exclude<DecisionFilter, null>[] = [
    "act_now",
    "verify_first",
    "watch",
  ];

  return (
    <section className="min-w-0 border border-line bg-white" aria-label={t("queueTitle")}>
      <div className="flex flex-col gap-3 border-b border-line p-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1 xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto" aria-label={t("decisionSegments")}>
            {decisions.map((decision) => {
              const active = decisionFilter === decision;
              const Icon = decisionIcon(decision);
              return (
                <button
                  key={decision}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onDecisionFilter(active ? null : decision)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-semibold transition",
                    active
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-line bg-white text-muted hover:border-line-strong hover:text-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
                  {feed(`triage.${decision}`)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label={t("sourceSegments")}>
            {sourceFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={sourceFilter === filter}
                onClick={() => onSourceFilter(filter)}
                className={cn(
                  "h-8 shrink-0 border-b-2 px-3 text-xs font-semibold transition",
                  sourceFilter === filter
                    ? "border-brand text-brand"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t(`sources.${filter}`)}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("resultCount", { count: items.length })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-line md:hidden">
        {items.map((item) => {
          const key = feedItemKey(item);
          const dossier = getFeedDossier(item);
          const recommendation = dossier?.triage.recommendation ?? "deprioritize";
          const Icon = decisionIcon(recommendation);
          const selected = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              data-opportunity-row={key}
              aria-pressed={selected}
              onClick={() => onSelect(item)}
              className={cn(
                "w-full border-l-2 px-3 py-3 text-left",
                selected
                  ? "border-brand bg-brand-soft/60"
                  : "border-transparent bg-white",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{getFeedTitle(item)}</p>
                  <p className="mt-1 truncate text-xs text-muted">
                    {getFeedLocation(item)} · {item.kind === "permit" ? t("permitRecord") : t("tenderRecord")}
                  </p>
                  {item.kind === "tender" && (item.tender.isThursday || item.tender.requiresAmp) && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {item.tender.isThursday && (
                        <span className="rounded border border-brand/30 bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">{feed("thursday")}</span>
                      )}
                      {item.tender.requiresAmp && (
                        <span className="rounded border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-ink">{feed("ampRequired")}</span>
                      )}
                    </span>
                  )}
                </div>
                <span className="tabular-nums text-sm font-semibold text-brand">
                  {t("proofCount", { count: proofCount(item, dossier) })}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={cn("inline-flex items-center gap-2 text-xs font-semibold", decisionTone(recommendation))}>
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                  {feed(`triage.${recommendation}`)}
                </span>
                <span className="text-xs font-medium text-ink">{value(item, locale) ?? t("valueUnavailable")}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div role="table" className="min-w-[820px]">
          <div
            role="row"
            className="grid h-10 grid-cols-[82px_minmax(210px,1.45fr)_minmax(115px,.75fr)_minmax(125px,.8fr)_78px_minmax(135px,1fr)] items-center border-b border-line bg-surface-2 px-3 text-[11px] font-semibold text-muted"
          >
            <span role="columnheader">{t("columns.decision")}</span>
            <span role="columnheader">{t("columns.opportunity")}</span>
            <span role="columnheader">{t("columns.location")}</span>
            <span role="columnheader">{t("columns.valueDeadline")}</span>
            <span role="columnheader">{t("columns.confidence")}</span>
            <span role="columnheader">{t("columns.nextAction")}</span>
          </div>
          <div role="rowgroup" className="divide-y divide-line">
            {items.map((item) => {
              const key = feedItemKey(item);
              const dossier = getFeedDossier(item);
              const recommendation = dossier?.triage.recommendation ?? "deprioritize";
              const Icon = decisionIcon(recommendation);
              const itemValue = value(item, locale);
              const itemDeadline = deadline(item, locale);
              const selected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  data-opportunity-row={key}
                  role="row"
                  aria-selected={selected}
                  onClick={() => onSelect(item)}
                  className={cn(
                    "grid min-h-[74px] w-full grid-cols-[82px_minmax(210px,1.45fr)_minmax(115px,.75fr)_minmax(125px,.8fr)_78px_minmax(135px,1fr)] items-center px-3 text-left transition",
                    selected
                      ? "border-l-2 border-brand bg-brand-soft/60 pl-[10px]"
                      : "border-l-2 border-transparent bg-white pl-[10px] hover:bg-surface-hover",
                  )}
                >
                  <span role="cell" className={cn("flex items-center gap-2 text-xs font-semibold", decisionTone(recommendation))}>
                    <Icon className="h-4 w-4" strokeWidth={1.7} />
                    {feed(`triage.${recommendation}`)}
                  </span>
                  <span role="cell" className="min-w-0 pr-4">
                    <span className="block truncate text-sm font-semibold text-ink">{getFeedTitle(item)}</span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {item.kind === "permit" ? t("permitRecord") : t("tenderRecord")}
                    </span>
                    {item.kind === "tender" && (item.tender.isThursday || item.tender.requiresAmp) && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {item.tender.isThursday && (
                          <span className="rounded border border-brand/30 bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">{feed("thursday")}</span>
                        )}
                        {item.tender.requiresAmp && (
                          <span className="rounded border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning-ink">{feed("ampRequired")}</span>
                        )}
                      </span>
                    )}
                  </span>
                  <span role="cell" className="min-w-0 pr-4">
                    <span className="block truncate text-sm font-medium text-ink">{getFeedLocation(item)}</span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {item.kind === "permit"
                        ? item.permit.city ?? item.permit.address
                        : item.tender.organization ?? "Québec"}
                    </span>
                  </span>
                  <span role="cell" className="pr-4 tabular-nums">
                    <span className="block text-sm font-medium text-ink">
                      {itemValue ?? t("valueUnavailable")}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {itemDeadline ?? t("deadlineUnavailable")}
                    </span>
                  </span>
                  <span role="cell">
                    <span className="block text-sm font-semibold text-ink">
                      {t("proofCount", { count: proofCount(item, dossier) })}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {item.kind === "permit" ? t("permitRecord") : t("tenderRecord")}
                    </span>
                  </span>
                  <span role="cell" className="min-w-0 pl-3">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {feed(`triage.${recommendation}`)}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">
                      {dossier?.nextAction ?? t("openDossier")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
