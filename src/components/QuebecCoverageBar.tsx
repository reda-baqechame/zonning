"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { Database, MapPin } from "lucide-react";
import type { CityPulseRow } from "@/lib/market-pulse";

type QuebecStats = {
  datasetCount: number;
  coverageCities: number;
  rgm: {
    permitsToday: number;
    permitsWeek: number;
    cities: CityPulseRow[];
  };
  cityBreakdown: CityPulseRow[];
  dataLayers: {
    permits: number;
    tenders: number;
    rbq: number;
    zoning: number;
    transactions: number;
    assessment: number;
    heritage: number;
    contracts: number;
    contamination?: number;
    roadworks?: number;
    companies?: number;
    awards?: number;
  };
  registeredSources?: number;
  searchableMunicipalities?: number;
  updatedAt: string;
};

function formatCount(n: number, locale: string): string {
  return n.toLocaleString(locale === "fr" ? "fr-CA" : "en-CA");
}

export default function QuebecCoverageBar({ compact }: { compact?: boolean }) {
  const t = useTranslations("quebec");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enCA;
  const [stats, setStats] = useState<QuebecStats | null>(null);

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats?.rgm?.cities?.length) return null;

  const rgmCities = stats.rgm.cities;
  const otherCities = stats.cityBreakdown.filter((c) => !c.isRgm && c.totalPermits > 0);

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-soft px-3 py-2 text-xs text-brand">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {t("compactCoverage", {
            datasets: stats.datasetCount,
            municipalities: stats.searchableMunicipalities ?? 0,
          })}
        </span>
      </div>
    );
  }

  const layerTotal = Object.values(stats.dataLayers).reduce(
    (total, count) => total + (count ?? 0),
    0,
  );

  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand">
              {t("engineEyebrow")}
            </p>
            <h2 className="text-sm font-semibold text-ink md:text-base">
              {t("coverageTitle", {
                municipalities: stats.searchableMunicipalities ?? 0,
              })}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {t("coverageMeta", {
                datasets: stats.datasetCount,
                sources: stats.registeredSources ?? stats.datasetCount,
                records: formatCount(layerTotal, locale),
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-success-ink">
            <Database className="h-3 w-3" />
            {t("databaseBacked")}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {rgmCities.map((city) => (
            <div
              key={city.city}
              className="rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-1)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-brand" />
                  <span className="text-sm font-semibold text-ink">{city.city}</span>
                </div>
                {city.permitsToday > 0 && (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning-ink">
                    +{city.permitsToday}
                  </span>
                )}
              </div>
              <p className="mt-2 text-lg font-bold text-brand">
                {formatCount(city.totalPermits, locale)}
                <span className="ml-1 text-xs font-normal text-muted">{t("permitsIndexed")}</span>
              </p>
              <p className="text-xs text-muted">
                {t("weekCount", { count: city.permitsWeek })}
                {city.totalPermits > 0 && (
                  <>
                    {" · "}
                    {t("mapPercent", {
                      pct: Math.round((city.mappablePermits / city.totalPermits) * 100),
                    })}
                  </>
                )}
                {city.lastSyncAt && (
                  <>
                    {" · "}
                    {formatDistanceToNow(new Date(city.lastSyncAt), {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        {otherCities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {otherCities.map((city) => (
              <span
                key={city.city}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-[11px] text-muted"
              >
                {city.city}: {formatCount(city.totalPermits, locale)}
                {city.permitsToday > 0 && (
                  <span className="ml-1 text-warning-ink">+{city.permitsToday}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted sm:grid-cols-4 lg:grid-cols-12">
          {[
            { label: t("layerPermits"), value: stats.dataLayers.permits },
            { label: t("layerTenders"), value: stats.dataLayers.tenders },
            { label: t("layerRbq"), value: stats.dataLayers.rbq },
            { label: t("layerZoning"), value: stats.dataLayers.zoning },
            { label: t("layerTransactions"), value: stats.dataLayers.transactions },
            { label: t("layerAssessment"), value: stats.dataLayers.assessment },
            { label: t("layerHeritage"), value: stats.dataLayers.heritage },
            { label: t("layerContracts"), value: stats.dataLayers.contracts },
            { label: t("layerContamination"), value: stats.dataLayers.contamination ?? 0 },
            { label: t("layerRoadworks"), value: stats.dataLayers.roadworks ?? 0 },
            { label: t("layerAwards"), value: stats.dataLayers.awards ?? 0 },
            { label: t("layerCompanies"), value: stats.dataLayers.companies ?? 0 },
          ].map((layer) => (
            <div key={layer.label} className="rounded border border-line bg-surface px-2 py-1">
              <span className="block text-ink">{formatCount(layer.value, locale)}</span>
              {layer.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
