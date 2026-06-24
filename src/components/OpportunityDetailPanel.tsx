"use client";

import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, FieldLabel, Select } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import {
  getFeedDossier,
  getFeedLocation,
  getFeedSourceUrl,
  getFeedTitle,
  type FeedItem,
} from "@/lib/feed";
import type { PipelineStage } from "@/lib/domain/quebec";

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function observedDate(item: FeedItem, locale: string) {
  const dossier = getFeedDossier(item);
  const raw = dossier?.freshness.observedAt;
  if (!raw) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(raw));
}

export function OpportunityDetailPanel({
  item,
  locale,
  draft,
  saving,
  complianceEnabled,
  onToggleSave,
  onCompliance,
  onDraftChange,
  onSavePipeline,
}: {
  item?: FeedItem | null;
  locale: string;
  draft?: { note: string; stage: PipelineStage; nextActionAt: string };
  saving: boolean;
  complianceEnabled: boolean;
  onToggleSave: (item: FeedItem) => void;
  onCompliance: (item: FeedItem) => void;
  onDraftChange: (draft: { note: string; stage: PipelineStage; nextActionAt: string }) => void;
  onSavePipeline: (item: FeedItem) => void;
}) {
  const t = useTranslations("feed.workspace");
  const feed = useTranslations("feed");
  const common = useTranslations("common");

  if (!item) {
    return (
      <aside className="grid min-h-80 place-items-center border border-line bg-white p-8 text-center text-sm text-muted xl:sticky xl:top-0 xl:h-[calc(100vh-1rem)]">
        {t("selectOpportunity")}
      </aside>
    );
  }

  const dossier = getFeedDossier(item);
  const mission = dossier?.governmentMission;
  const decision = dossier?.decision;
  const recommendation = dossier?.triage.recommendation ?? "deprioritize";
  const confirmed = unique([
    ...(dossier?.siteIntelligence?.confirmedFacts ?? []),
    item.kind === "permit" && item.permit.dataQuality?.officialSource
      ? t("confirmed.publicPermit")
      : "",
    item.signals.some((signal) => signal.id === "rbq_eligible")
      ? t("confirmed.rbqFit")
      : "",
    item.kind === "tender" ? t("confirmed.seaoNotice") : "",
  ]).slice(0, 4);
  const checks = unique([
    ...(dossier?.siteIntelligence?.unavailableEvidence ?? []),
    ...(dossier?.limitations ?? []),
  ]).slice(0, 4);
  const sourceUrl = getFeedSourceUrl(item);
  const observed = observedDate(item, locale);
  const pipeline = draft ?? {
    note: item.savedNote ?? "",
    stage: item.savedStage ?? "new",
    nextActionAt: item.savedNextActionAt?.slice(0, 10) ?? "",
  };
  const stages: PipelineStage[] = [
    "new",
    "researching",
    "pursuing",
    "submitted",
    "won",
    "lost",
    "archived",
  ];

  return (
    <aside className="border border-line bg-white xl:sticky xl:top-0 xl:max-h-screen xl:overflow-y-auto">
      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-medium text-muted">
          {item.kind === "permit" ? t("permitRecord") : t("tenderRecord")}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-7 text-ink">
          {getFeedTitle(item)}
        </h2>
        <p className="mt-1 text-sm text-muted">{getFeedLocation(item)}</p>
      </div>

      <div className="space-y-5 p-5">
        <section className="border-l-2 border-brand pl-4">
          <p className="text-[11px] font-semibold uppercase text-subtle">{t("nextActionTitle")}</p>
          <p className="mt-1 text-base font-semibold leading-6 text-ink">
            {dossier?.nextAction ?? t("selectOpportunity")}
          </p>
        </section>

        <section className="border-l-2 border-brand pl-4">
          <p className="text-[11px] font-semibold uppercase text-subtle">{t("recommendation")}</p>
          <p className="mt-1 text-lg font-semibold text-brand">
            {feed(`triage.${recommendation}`)}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {dossier?.triage.reason ?? dossier?.nextAction}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted">
            <span>{t("proofLevel", { count: confirmed.length })}</span>
            <span>{feed(`effort.${dossier?.triage.effort ?? "heavy"}`)}</span>
          </div>
        </section>

        {decision ? (
          <section className="border border-line bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase text-subtle">
                  {feed("decision.title")}
                </p>
                <p className="mt-1 text-lg font-bold text-ink">
                  {feed(`mission.verdict.${decision.worthPursuing}`)}
                </p>
                <p className="mt-1 text-sm text-muted">{decision.headline}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="tabular-nums text-2xl font-bold text-brand">
                  {decision.winProbability}%
                </p>
                <p className="text-[11px] text-subtle">{feed("decision.winProbability")}</p>
              </div>
            </div>

            {decision.expectedValue != null ? (
              <p className="mt-3 text-sm text-muted">
                {feed("decision.expectedValue")}:{" "}
                <span className="font-semibold text-ink">
                  {new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
                    style: "currency",
                    currency: "CAD",
                    maximumFractionDigits: 0,
                  }).format(decision.expectedValue)}
                </span>
                <span className="ml-1 text-xs text-subtle">({feed("decision.estimated")})</span>
              </p>
            ) : null}

            {decision.personalBlockers.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {decision.personalBlockers.map((blocker) => (
                  <li
                    key={blocker.id}
                    className={`flex gap-2 text-xs ${
                      blocker.severity === "blocker" ? "text-danger" : "text-warning"
                    }`}
                  >
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{blocker.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div
              className={`mt-3 rounded border px-3 py-2 text-sm ${
                decision.buyDocuments
                  ? "border-success/30 bg-success/5 text-ink"
                  : "border-warning/30 bg-warning/5 text-ink"
              }`}
            >
              <p className="font-semibold">
                {decision.buyDocuments
                  ? feed("decision.buyDocumentsYes")
                  : feed("decision.buyDocumentsNo")}
              </p>
              <p className="mt-1 text-xs text-muted">{decision.buyDocumentsReason}</p>
            </div>

            <p className="mt-2 text-xs text-muted">{decision.deadlineLabel}</p>

            {item.kind === "tender" && (item.tender.amendmentCount ?? 0) > 0 ? (
              <p className="mt-2 rounded border border-warning/30 bg-warning/5 px-2 py-1.5 text-xs text-warning-ink">
                {feed("decision.addendaWarning", { count: item.tender.amendmentCount ?? 0 })}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={decision.primaryButton.href}
                target={decision.primaryButton.href.startsWith("http") ? "_blank" : undefined}
                rel={decision.primaryButton.href.startsWith("http") ? "noreferrer" : undefined}
                className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-brand-hover"
              >
                {decision.primaryButton.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {item.kind === "tender" ? (
                <Link
                  href={`/proposals?tenderId=${item.id}`}
                  className="inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-2"
                >
                  {feed("decision.buildProposal")}
                </Link>
              ) : null}
              {decision.trackRecommended ? (
                item.saved ? (
                  <span className="inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/5 px-3 py-1.5 text-xs font-semibold text-success-ink">
                    {feed("decision.tracking")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleSave(item)}
                    className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-soft/80"
                  >
                    {feed("decision.trackContract")}
                  </button>
                )
              ) : null}
            </div>
          </section>
        ) : null}

        {mission ? (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{feed("mission.taskBoard")}</h3>
              <span className="text-xs font-semibold text-brand">
                {feed(`mission.verdict.${mission.verdict}`)}
              </span>
            </div>
            <div className="border border-line">
              <div className="border-b border-line bg-surface-2 px-3 py-3">
                <p className="text-sm font-semibold text-ink">
                  {mission.worthBuyingDocuments
                    ? feed("mission.worthBuying")
                    : feed("mission.doNotBuyYet")}
                </p>
                <p className="mt-1 text-xs text-muted">{mission.deadlineLabel}</p>
              </div>
              <ol className="divide-y divide-line">
                {mission.taskBoard.map((task, index) => (
                  <li key={task.id} className="flex gap-3 px-3 py-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-ink">{task.title}</p>
                        <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          {feed(`mission.taskStatus.${task.status}`)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted">{task.detail}</p>
                      {task.deadlineLabel ? (
                        <p className="mt-1 text-xs font-medium text-warning-ink">
                          {task.deadlineLabel}
                        </p>
                      ) : null}
                      {task.href ? (
                        <a
                          href={task.href}
                          target={task.href.startsWith("http") ? "_blank" : undefined}
                          rel={task.href.startsWith("http") ? "noreferrer" : undefined}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          {task.buttonLabel}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <p className="mt-2 text-xs font-semibold text-brand">
                          {task.buttonLabel}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{t("confirmedTitle")}</h3>
            <span className="tabular-nums text-xs font-semibold text-success-ink">{confirmed.length}</span>
          </div>
          <div className="divide-y divide-line border border-line">
            {confirmed.length ? confirmed.map((fact) => (
              <div key={fact} className="flex gap-3 px-3 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.8} />
                <p className="text-sm leading-5 text-ink">{fact}</p>
              </div>
            )) : (
              <p className="px-3 py-3 text-sm text-muted">{t("noConfirmedEvidence")}</p>
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{t("verifyTitle")}</h3>
            <span className="tabular-nums text-xs font-semibold text-warning-ink">{checks.length}</span>
          </div>
          <div className="divide-y divide-line border border-line">
            {checks.map((check) => (
              <div key={check} className="flex gap-3 px-3 py-3">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.8} />
                <p className="text-sm leading-5 text-ink">{check}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">{t("officialSource")}</h3>
          <div className="border border-line px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink">{dossier?.sourceLabel}</p>
                {observed ? (
                  <p className="mt-1 text-xs text-muted">{t("observedAt", { date: observed })}</p>
                ) : null}
              </div>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-brand hover:bg-brand-soft"
                  aria-label={t("openOfficialSource")}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {!item.saved ? (
          <div className="space-y-2 border-t border-line pt-4">
            <Button className="w-full rounded-md" onClick={() => onToggleSave(item)}>
              <Plus className="h-4 w-4" />
              {t("addToPipeline")}
            </Button>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-brand text-sm font-semibold text-brand hover:bg-brand-soft"
              >
                {t("viewOfficialSource")}
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{t("pipelineTitle")}</h3>
              <button
                type="button"
                onClick={() => onToggleSave(item)}
                className="grid h-8 w-8 place-items-center rounded-md text-subtle hover:bg-danger-soft hover:text-danger"
                aria-label={feed("removeFromWatchlist")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor={`detail-stage-${item.id}`}>{feed("pipeline.stage")}</FieldLabel>
                <Select
                  id={`detail-stage-${item.id}`}
                  value={pipeline.stage}
                  onChange={(event) => onDraftChange({ ...pipeline, stage: event.target.value as PipelineStage })}
                  className="mt-1 rounded-md"
                >
                  {stages.map((stage) => (
                    <option key={stage} value={stage}>{feed(`pipeline.stages.${stage}`)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel htmlFor={`detail-date-${item.id}`}>{feed("pipeline.nextAction")}</FieldLabel>
                <input
                  id={`detail-date-${item.id}`}
                  type="date"
                  value={pipeline.nextActionAt}
                  onChange={(event) => onDraftChange({ ...pipeline, nextActionAt: event.target.value })}
                  className="mt-1 h-10 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div>
              <FieldLabel htmlFor={`detail-note-${item.id}`}>{feed("pipeline.note")}</FieldLabel>
              <textarea
                id={`detail-note-${item.id}`}
                rows={3}
                maxLength={2000}
                value={pipeline.note}
                onChange={(event) => onDraftChange({ ...pipeline, note: event.target.value })}
                placeholder={feed("pipeline.notePlaceholder")}
                className="mt-1 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              variant="secondary"
              className="w-full rounded-md"
              disabled={saving}
              onClick={() => onSavePipeline(item)}
            >
              <Save className="h-4 w-4" />
              {saving ? common("loading") : feed("pipeline.save")}
            </Button>
          </div>
        )}

        {item.kind === "permit" && complianceEnabled && dossier?.complianceAction?.enabled ? (
          <Button variant="ghost" className="w-full rounded-md" onClick={() => onCompliance(item)}>
            {dossier.complianceAction.label}
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
