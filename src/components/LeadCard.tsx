"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { Star } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import type { LeadSignal } from "@/lib/lead-signals";
import { formatCad } from "@/lib/format-cad";
import SiteIntelligencePanel, {
  type IntelAccess,
} from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";

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
  pipeline?: {
    breakdown?: { rbqFit: number; costFit: number; competition: number; intelligence: number; zoning: number };
    densityGapLabelFr?: string;
    densityGapLabelEn?: string;
  };
  sourceUrl?: string;
  applicantName?: string | null;
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
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-sky-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-medium text-slate-200">{score}</span>
    </div>
  );
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
}: LeadCardProps) {
  const t = useTranslations("leadSignals");
  const tf = useTranslations("feed");
  const tFomo = useTranslations("fomo");
  const [expanded, setExpanded] = useState(false);
  const dateLocale = locale === "fr" ? fr : enCA;

  const urgent = item.signals.some(
    (s) => s.id === "urgent_close" || s.id === "thursday_seao"
  );

  const isHighValue =
    item.kind === "permit" &&
    item.estimatedCost != null &&
    item.estimatedCost >= 500_000;

  const freshness =
    item.kind === "permit" && item.issueDate
      ? formatDistanceToNow(new Date(item.issueDate), { addSuffix: true, locale: dateLocale })
      : null;

  return (
    <Card
      className={`cursor-pointer transition ${
        selected ? "border-sky-500 ring-1 ring-sky-500/40" : urgent ? "border-amber-500/40" : ""
      }`}
      hover
    >
      <div onClick={onSelect} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {item.kind === "permit" ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{item.permitType}</p>
                  {isHighValue && item.estimatedCost != null && (
                    <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-300">
                      {formatCad(item.estimatedCost, locale)}
                    </span>
                  )}
                  {freshness && (
                    <span className="text-xs text-slate-500">{freshness}</span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {item.address}
                  {item.borough ? ` · ${item.borough}` : ""}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                  {(locale === "fr" ? item.summaryFr : item.summaryEn) ||
                    `${item.permitType}${item.borough ? ` · ${item.borough}` : ""}`}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-white">{item.title}</p>
                <p className="text-sm text-slate-400">{item.organization}</p>
                {item.plainSummary && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-300">{item.plainSummary}</p>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {item.score >= 75 && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                {tFomo("topLead")}
              </span>
            )}
            <ScoreBar score={item.score} />
            {onSave && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSave();
                }}
                className="text-slate-500 hover:text-amber-400"
                aria-label="Save"
              >
                <Star className={`h-4 w-4 ${saved ? "fill-amber-400 text-amber-400" : ""}`} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
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

        {countdown}

        {item.kind === "permit" && intelligence && (
          <SiteIntelligencePanel
            intel={intelligence}
            locale={locale}
            access={intelAccess}
          />
        )}

        {item.kind === "permit" && item.pipeline?.breakdown && expanded && (
          <dl className="mt-3 grid grid-cols-2 gap-1 text-xs text-slate-400">
            <dt>RBQ</dt>
            <dd>{item.pipeline.breakdown.rbqFit}</dd>
            <dt>Coût</dt>
            <dd>{item.pipeline.breakdown.costFit}</dd>
            <dt>Compétition</dt>
            <dd>{item.pipeline.breakdown.competition}</dd>
            <dt>Intel</dt>
            <dd>{item.pipeline.breakdown.intelligence}</dd>
            <dt>Zonage</dt>
            <dd>{item.pipeline.breakdown.zoning}</dd>
          </dl>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {item.kind === "permit" && item.pipeline?.breakdown && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? "−" : "+"} Score
            </Button>
          )}
          {item.kind === "permit" && item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm">
                {tf("source")}
              </Button>
            </a>
          )}
          {item.kind === "tender" && (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm">
                SEAO →
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
