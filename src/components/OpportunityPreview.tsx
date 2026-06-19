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
    <section className="border-y border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 py-16">
      <div className="mx-auto max-w-5xl px-4">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
            {t("previewEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">{t("previewTitle")}</h2>
          {stats && (
            <p className="mt-3 text-slate-400">
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
              className="relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/80 p-5"
            >
              <div className="select-none blur-[6px]">
                <p className="font-semibold text-white">{lead.label}</p>
                <p className="mt-1 text-sm text-slate-400">{lead.borough ?? "QC"}</p>
                {lead.valueLabel && (
                  <p className="mt-2 text-lg font-bold text-emerald-400">{lead.valueLabel}</p>
                )}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${lead.score}%` }}
                  />
                </div>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/75 p-4 text-center">
                <Lock className="h-6 w-6 text-amber-400" />
                <p className="text-sm font-medium text-white">{t("previewLocked")}</p>
                {lead.signal && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
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
            className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-8 py-3 font-semibold text-white transition hover:bg-sky-400"
          >
            {t("previewCta")}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-sm text-slate-500">
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
