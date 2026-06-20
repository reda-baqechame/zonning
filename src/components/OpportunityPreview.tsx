"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ArrowRight, Lock } from "lucide-react";
import { formatCad } from "@/lib/format-cad";

type PreviewLead = {
  id: string;
  kind: "permit" | "tender";
  label: string;
  borough?: string | null;
  score: number;
  valueLabel?: string;
  signal?: string;
};

export default function OpportunityPreview() {
  const t = useTranslations("fomo");
  const locale = useLocale();
  const [leads, setLeads] = useState<PreviewLead[]>([]);
  const [stats, setStats] = useState<{
    highValueWeek: number;
    permitsWeek: number;
    estimatedValueWeek?: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/stats/preview")
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setStats(d.stats ?? null);
      })
      .catch(() => {});
  }, []);

  if (leads.length === 0) return null;

  return (
    <section className="border-y border-line bg-white py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-warning-ink">
            {t("previewEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-ink md:text-3xl">{t("previewTitle")}</h2>
          {stats && (
            <p className="mt-3 text-muted">
              {t("previewSubtitle", {
                permits: stats.permitsWeek,
                highValue: stats.highValueWeek,
              })}
            </p>
          )}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="relative overflow-hidden rounded-xl border border-line bg-surface-2 p-5 shadow-[var(--shadow-1)]"
            >
              <div className="select-none blur-[6px]">
                <p className="font-semibold text-ink">{lead.label}</p>
                <p className="mt-1 text-sm text-muted">{lead.borough ?? "QC"}</p>
                {lead.valueLabel && (
                  <p className="mt-2 text-lg font-bold text-success-ink">{lead.valueLabel}</p>
                )}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-success"
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 p-4 text-center backdrop-blur-[2px]">
                <Lock className="h-6 w-6 text-warning-ink" />
                <p className="text-sm font-medium text-ink">{t("previewLocked")}</p>
                {lead.signal && (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-ink">
                    {lead.signal}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-8 py-3 font-semibold text-white transition hover:bg-brand-hover"
          >
            {t("previewCta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-sm text-muted">
            {stats?.estimatedValueWeek
              ? t("previewFootnote", {
                  value: formatCad(stats.estimatedValueWeek, locale),
                })
              : t("previewFootnoteGeneric")}
          </p>
        </div>
      </div>
    </section>
  );
}
