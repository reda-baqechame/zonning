"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { formatCad } from "@/lib/format-cad";

export default function HomeStats() {
  const t = useTranslations("fomo");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enCA;
  const [stats, setStats] = useState<{
    permitsWeek: number;
    permitsToday: number;
    highValueWeek: number;
    tendersOpen: number;
    tendersClosingThursday: number;
    estimatedValueWeek: number;
    companies: number;
    permitsLastSuccessAt?: string | null;
    datasetCount?: number;
    coverageCities?: number;
    intelDatasets?: number;
    rbqLicenses?: number;
    cities?: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const freshness =
    stats.permitsLastSuccessAt &&
    formatDistanceToNow(new Date(stats.permitsLastSuccessAt), {
      addSuffix: true,
      locale: dateLocale,
    });

  const cards = [
    {
      value: stats.permitsToday > 0 ? stats.permitsToday : stats.permitsWeek,
      label: stats.permitsToday > 0 ? t("statToday") : t("statWeek"),
      hot: stats.permitsToday > 0,
    },
    {
      value: stats.highValueWeek,
      label: t("statHighValue"),
      hot: true,
    },
    {
      value: stats.tendersClosingThursday || stats.tendersOpen,
      label: stats.tendersClosingThursday ? t("statThursday") : t("statTenders"),
      hot: stats.tendersClosingThursday > 0,
    },
    {
      value: formatCad(stats.estimatedValueWeek, locale),
      label: t("statPipeline"),
      hot: false,
      isText: true,
    },
    {
      value: stats.companies.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA"),
      label: t("statCompanies"),
      hot: false,
      isText: true,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4">
      {freshness && (
        <p className="mb-4 text-center text-sm text-success-ink">
          {t("freshness", {
            time: freshness,
            datasets: stats.datasetCount ?? 33,
            cities: stats.coverageCities ?? 10,
          })}
          {(stats.intelDatasets != null || stats.rbqLicenses != null) && (
            <span className="mt-1 block text-xs text-muted">
              {stats.intelDatasets != null && t("intelLayers", { count: stats.intelDatasets })}
              {stats.intelDatasets != null && stats.rbqLicenses != null && " · "}
              {stats.rbqLicenses != null &&
                t("rbqRegistry", {
                  count: stats.rbqLicenses.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA"),
                })}
            </span>
          )}
          {stats.cities && stats.cities.length > 0 && (
            <span className="mt-1 block text-xs text-muted">
              {stats.cities.join(" · ")}
            </span>
          )}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border p-4 text-center shadow-sm transition-shadow hover:shadow-2 ${
              card.hot
                ? "border-brand-border bg-brand-soft"
                : "border-line bg-surface"
            }`}
          >
            <p
              className={`text-2xl font-bold tabular-nums md:text-3xl ${
                card.hot ? "text-brand" : "text-ink"
              }`}
            >
              {card.isText ? card.value : card.value}
            </p>
            <p className="mt-1 text-xs text-muted md:text-sm">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
