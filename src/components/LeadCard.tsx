"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { ChevronDown, ExternalLink, FolderPlus, Star } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import type { LeadSignal } from "@/lib/lead-signals";
import { formatCad } from "@/lib/format-cad";
import SiteIntelligencePanel, {
  type IntelAccess,
} from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { PipelineScoreResult, RankingReason } from "@/lib/pipeline-score";
import type { TenderScoreResult } from "@/lib/tender-score";
import type { PermitDataQuality } from "@/lib/permits/quality";
import type { OpportunityDossier } from "@/lib/domain/quebec";

export type LeadCardPermit = {
  kind: "permit";
  id: string;
  score: number;
  signals: LeadSignal[];
  permitType: string;
  address: string;
  borough?: string | null;
  estimatedCost?: number | null;
  issueDate?: string | Date | null;
  summaryFr?: string | null;
  summaryEn?: string | null;
  rbqFit?: { eligible: boolean; score: number };
  pipeline?: PipelineScoreResult;
  sourceUrl?: string;
  applicantName?: string | null;
  dataQuality?: PermitDataQuality;
  opportunityDossier?: OpportunityDossier;
};

export type LeadCardTender = {
  kind: "tender";
  id: string;
  score: number;
  signals: LeadSignal[];
  title: string;
  organization?: string | null;
  daysLeft?: number | null;
  isThursday?: boolean;
  urgent?: boolean;
  requiresAmp?: boolean;
  plainSummary?: string;
  sourceUrl: string;
  amendmentCount?: number;
  ranking?: TenderScoreResult;
  opportunityDossier?: OpportunityDossier;
};

export type LeadCardProps = {
  item: LeadCardPermit | LeadCardTender;
  locale: string;
  selected?: boolean;
  saved?: boolean;
  complianceEnabled?: boolean;
  onSelect?: () => void;
  onSave?: () => void;
  onCompliance?: () => void;
  countdown?: React.ReactNode;
  intelligence?: PropertyIntelligence | null;
  intelAccess?: IntelAccess;
  testData?: boolean;
};

function ScoreBar({
  score,
  scoreLabel,
  confidenceText,
}: {
  score: number;
  scoreLabel: string;
  confidenceText?: string;
}) {
  const color =
    score >= 75 ? "bg-success" : score >= 50 ? "bg-brand" : "bg-warning";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium text-ink" aria-label={scoreLabel}>
        {score}
      </span>
      {confidenceText ? (
        <span className="text-[11px] text-subtle">{confidenceText}</span>
      ) : null}
    </div>
  );
}

function reasonVariant(reason: RankingReason) {
  if (reason.impact === "positive") return "success" as const;
  if (reason.impact === "warning") return "warning" as const;
  return "default" as const;
}

function factorValue(value: number | null | undefined): string {
  return value == null ? "—" : String(value);
}

export function LeadCard({
  item,
  locale,
  selected,
  saved,
  complianceEnabled,
  onSelect,
  onSave,
  onCompliance,
  countdown,
  intelligence,
  intelAccess = "full",
  testData = false,
}: LeadCardProps) {
  const t = useTranslations("leadSignals");
  const tf = useTranslations("feed");
  const tFomo = useTranslations("fomo");
  const [expanded, setExpanded] = useState(false);
  const dateLocale = locale === "fr" ? fr : enCA;
  const ranking = item.kind === "permit" ? item.pipeline : item.ranking;
  const dossier = item.opportunityDossier;
  const triage = dossier?.triage;
  const topLeadAllowed =
    dossier?.evidenceThresholds.canCallTopLead ??
    (item.score >= 80 && (ranking?.confidence ?? 0) >= 65);

  const urgent = item.signals.some(
    (s) => s.id === "urgent_close" || s.id === "thursday_seao",
  );

  const isHighValue =
    item.kind === "permit" &&
    item.estimatedCost != null &&
    item.estimatedCost >= 500_000;

  const freshness =
    item.kind === "permit" && item.issueDate
      ? formatDistanceToNow(new Date(item.issueDate), {
          addSuffix: true,
          locale: dateLocale,
        })
      : null;
  const actionBy = triage?.actionBy
    ? new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
        month: "short",
        day: "numeric",
      }).format(new Date(triage.actionBy))
    : null;
  const triageTone =
    triage?.recommendation === "act_now"
      ? "border-success bg-success-soft"
      : triage?.recommendation === "verify_first"
        ? "border-warning bg-warning-soft"
        : "border-line-strong bg-slate-50";

  return (
    <Card
      className={`cursor-pointer transition ${
        selected
          ? "border-brand ring-1 ring-ring"
          : urgent
            ? "border-warning/40"
            : ""
      }`}
      hover
    >
      <div
        onClick={onSelect}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {item.kind === "permit" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-ink">{item.permitType}</p>
                  {isHighValue && item.estimatedCost != null && (
                    <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-bold text-success-ink">
                      {tf("declaredValue", {
                        value: formatCad(item.estimatedCost, locale),
                      })}
                    </span>
                  )}
                  {freshness && (
                    <span className="text-xs text-subtle">{freshness}</span>
                  )}
                </div>
                <p className="text-sm text-muted">
                  {item.address}
                  {item.borough ? ` · ${item.borough}` : ""}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {(locale === "fr" ? item.summaryFr : item.summaryEn) ||
                    `${item.permitType}${item.borough ? ` · ${item.borough}` : ""}`}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink">{item.title}</p>
                <p className="text-sm text-muted">{item.organization}</p>
                {item.plainSummary && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">
                    {item.plainSummary}
                  </p>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {topLeadAllowed && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-ink">
                {testData ? tf("testRank") : tFomo("topLead")}
              </span>
            )}
            <ScoreBar
              score={item.score}
              scoreLabel={tf("rankCompact", { value: item.score })}
              confidenceText={
                ranking
                  ? tf("confidenceCompact", { value: ranking.confidence })
                  : undefined
              }
            />
            {onSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className="text-subtle hover:text-warning-ink"
                aria-label={
                  saved ? tf("removeFromWatchlist") : tf("addToWatchlist")
                }
              >
                <Star
                  className={`h-4 w-4 ${saved ? "fill-warning text-warning-ink" : ""}`}
                />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.kind === "permit" && item.dataQuality ? (
            <Badge variant={item.dataQuality.grade === "low" ? "warning" : "default"}>
              {tf(`dataQuality.${item.dataQuality.grade}`)}
            </Badge>
          ) : null}
          {item.signals.map((s) => (
            <Badge
              key={s.id}
              variant={
                s.severity === "positive"
                  ? "success"
                  : s.severity === "warning"
                    ? "warning"
                    : "primary"
              }
            >
              {t(s.id)}
            </Badge>
          ))}
          {item.kind === "tender" && item.amendmentCount ? (
            <Badge variant="default">{item.amendmentCount} mod.</Badge>
          ) : null}
        </div>

        {ranking?.reasons.length ? (
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            aria-label={tf("rankingReasonsLabel")}
          >
            {ranking.reasons.map((reason) => (
              <Badge key={reason.id} variant={reasonVariant(reason)}>
                {tf(`rankingReasons.${reason.id}`)}
              </Badge>
            ))}
          </div>
        ) : null}

        {triage ? (
          <div className={`mt-3 border-l-4 px-3 py-2.5 ${triageTone}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                {tf(`triage.${triage.recommendation}`)}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{tf(`effort.${triage.effort}`)}</span>
                {actionBy ? <span>{tf("actionBy", { date: actionBy })}</span> : null}
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">{triage.reason}</p>
            {triage.blockers.length ? (
              <p className="mt-1 text-xs text-warning-ink">
                {tf("blockers", { count: triage.blockers.length })}
              </p>
            ) : null}
          </div>
        ) : null}

        {dossier ? (
          <div className="mt-3 grid gap-3 rounded-md border border-line bg-slate-50 p-3 text-xs text-muted md:grid-cols-3">
            <div>
              <p className="font-semibold uppercase text-subtle">
                {tf("dossier.source")}
              </p>
              <p className="mt-1 font-medium text-ink">{dossier.sourceLabel}</p>
              <p>{tf(`freshness.${dossier.freshness.label}`)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase text-subtle">
                {tf("dossier.nextAction")}
              </p>
              <p className="mt-1 text-ink">{dossier.nextAction}</p>
            </div>
            <div>
              <p className="font-semibold uppercase text-subtle">
                {tf("dossier.trust")}
              </p>
              <p className="mt-1">
                {tf("dossier.confidence", {
                  value: dossier.confidence,
                  level: tf(`confidenceLevels.${dossier.confidenceLevel}`),
                })}
              </p>
              {!dossier.evidenceThresholds.canCallTopLead ? (
                <p className="mt-1 text-warning-ink">
                  {tf("dossier.notTopLead")}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {countdown}

        {item.kind === "permit" && intelligence && (
          <SiteIntelligencePanel
            intel={intelligence}
            locale={locale}
            access={intelAccess}
          />
        )}

        {ranking && expanded ? (
          <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
            {dossier?.whyRanked.length ? (
              <div className="mb-3">
                <p className="font-medium text-ink">{tf("dossier.why")}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {dossier.whyRanked.slice(0, 4).map((why) => (
                    <li key={why}>{why}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <div>
                <dt>{tf("rankScore")}</dt>
                <dd className="font-medium text-ink">{ranking.score}</dd>
              </div>
              <div>
                <dt>{tf("fitScore")}</dt>
                <dd className="font-medium text-ink">{ranking.fitScore}</dd>
              </div>
              <div>
                <dt>{tf("confidenceLabel")}</dt>
                <dd className="font-medium text-ink">{ranking.confidence}%</dd>
              </div>
            </dl>
            {item.kind === "permit" ? (
              <>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                <div>
                  <dt>{tf("factorRbq")}</dt>
                  <dd>{factorValue(item.pipeline?.breakdown.rbqFit)}</dd>
                </div>
                <div>
                  <dt>{tf("factorCost")}</dt>
                  <dd>{factorValue(item.pipeline?.breakdown.costFit)}</dd>
                </div>
                <div>
                  <dt>{tf("factorMarket")}</dt>
                  <dd>
                    {factorValue(item.pipeline?.breakdown.marketActivity)}
                  </dd>
                </div>
                <div>
                  <dt>{tf("factorFreshness")}</dt>
                  <dd>{factorValue(item.pipeline?.breakdown.freshness)}</dd>
                </div>
                <div>
                  <dt>{tf("factorIntel")}</dt>
                  <dd>{factorValue(item.pipeline?.breakdown.intelligence)}</dd>
                </div>
                <div>
                  <dt>{tf("factorZoning")}</dt>
                  <dd>{factorValue(item.pipeline?.breakdown.zoning)}</dd>
                </div>
                </dl>
                {item.dataQuality?.issues.length ? (
                  <div className="mt-3">
                    <p className="font-medium text-ink">{tf("dataQuality.limitations")}</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {item.dataQuality.issues.map((issue) => (
                        <li key={issue}>{tf(`dataQuality.issues.${issue}`)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
            {dossier?.limitations.length ? (
              <div className="mt-3">
                <p className="font-medium text-ink">
                  {tf("dossier.limitations")}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {dossier.limitations.slice(0, 5).map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {ranking && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              <ChevronDown
                className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
              {tf("whyRank")}
            </Button>
          )}
          {onSave && !saved ? (
            <Button
              variant="primary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                onSave();
              }}
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              {tf("addPipeline")}
            </Button>
          ) : null}
          {item.kind === "permit" && item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {item.dataQuality?.sourceScope === "record"
                  ? tf("recordSource")
                  : tf("datasetSource")}
              </Button>
            </a>
          )}
          {item.kind === "tender" && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                SEAO
              </Button>
            </a>
          )}
          {complianceEnabled && onCompliance && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCompliance();
              }}
            >
              CASL
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
