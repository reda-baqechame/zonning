"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { MapPin, Radio } from "lucide-react";
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
    const top = rgmCities.find((c) => c.permitsToday > 0) ?? rgmCities[0];
    return (
      <div className="flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-950/20 px-3 py-2 text-xs text-sky-100">
        <Radio className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span className="truncate">
          {t("rgmLive", {
            today: stats.rgm.permitsToday,
            city: top.city,
            count: top.permitsToday,
          })}
        </span>
      </div>
    );
  }

  const layerTotal =
    stats.dataLayers.permits +
    stats.dataLayers.tenders +
    stats.dataLayers.zoning +
    stats.dataLayers.transactions;

  return (
    <section className="border-b border-slate-800 bg-slate-950/80">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
              {t("engineEyebrow")}
            </p>
            <h2 className="text-sm font-semibold text-white md:text-base">
              {t("engineTitle", { cities: stats.coverageCities })}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t("engineMeta", {
                datasets: stats.datasetCount,
                cities: stats.coverageCities,
                records: formatCount(layerTotal, locale),
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {t("syncLive")}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {rgmCities.map((city) => (
            <div
              key={city.city}
              className="rounded-xl border border-sky-500/30 bg-gradient-to-br from-sky-950/40 to-slate-900/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-sm font-semibold text-white">{city.city}</span>
                </div>
                {city.permitsToday > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                    +{city.permitsToday}
                  </span>
                )}
              </div>
              <p className="mt-2 text-lg font-bold text-sky-200">
                {formatCount(city.totalPermits, locale)}
                <span className="ml-1 text-xs font-normal text-slate-500">{t("permitsIndexed")}</span>
              </p>
              <p className="text-xs text-slate-400">
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
                className="rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-1 text-[11px] text-slate-400"
              >
                {city.city}: {formatCount(city.totalPermits, locale)}
                {city.permitsToday > 0 && (
                  <span className="ml-1 text-amber-300">+{city.permitsToday}</span>
                )}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500 sm:grid-cols-4 lg:grid-cols-12">
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
            <div key={layer.label} className="rounded border border-slate-800/80 px-2 py-1">
              <span className="block text-slate-300">{formatCount(layer.value, locale)}</span>
              {layer.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
