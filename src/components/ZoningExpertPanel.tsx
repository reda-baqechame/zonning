"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui";
import type { ZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";

export default function ZoningExpertPanel({ analysis }: { analysis: ZoningExpertAnalysis }) {
  const t = useTranslations("zoningExpert");
  const statusVariant =
    analysis.status === "confirmed"
      ? "success"
      : analysis.status === "unavailable"
        ? "warning"
        : "default";

  return (
    <section className="border-t border-line pt-6" aria-labelledby="zoning-expert-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="zoning-expert-title" className="text-lg font-semibold text-ink">
            {t("title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant}>{t(`status.${analysis.status}`)}</Badge>
          <span className="text-sm font-medium text-ink">
            {t("confidence", { value: analysis.confidence })}
          </span>
        </div>
      </div>

      {!analysis.canConcludeCompliance ? (
        <div className="mt-4 flex gap-3 border-l-4 border-warning bg-warning-soft p-3 text-sm text-warning-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{t("noComplianceTitle")}</p>
            <p className="mt-1">{t("noComplianceBody")}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t("evidenceTitle")}</h3>
          {analysis.evidence.length ? (
            <div className="mt-2 space-y-3">
              {analysis.evidence.map((item, index) => (
                <div key={`${item.kind}-${index}`} className="border-l-2 border-brand pl-3 text-sm">
                  <p className="font-medium text-ink">{item.label}</p>
                  <p className="mt-0.5 text-muted">{t(`scope.${item.scope}`)}</p>
                  {item.matchDistanceMeters != null ? (
                    <p className="text-muted">
                      {t("distance", { value: Math.round(item.matchDistanceMeters) })}
                    </p>
                  ) : null}
                  {item.sourceUrl ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-brand hover:underline"
                    >
                      {t("officialSource")}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">{t("noEvidence")}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">{t("checklistTitle")}</h3>
            <span className="text-xs text-muted">
              {t("coverage", {
                verified: analysis.verifiedCheckCount,
                total: analysis.totalCheckCount,
              })}
            </span>
          </div>
          <ul className="mt-2 space-y-2">
            {analysis.checks.map((check) => (
              <li key={check.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  {check.status === "verified" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : check.status === "partial" ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  ) : (
                    <CircleDashed className="h-4 w-4 shrink-0 text-subtle" />
                  )}
                  {t(`checks.${check.id}`)}
                </span>
                <span className="shrink-0 text-xs text-muted">{t(`checkStatus.${check.status}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {analysis.warnings.length ? (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-semibold text-ink">{t("limitationsTitle")}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {analysis.warnings.map((warning) => (
              <li key={warning}>{t(`warnings.${warning}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
