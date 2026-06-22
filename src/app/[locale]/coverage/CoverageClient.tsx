"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import { Link } from "@/i18n/navigation";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";

type CoverageData = {
  datasetCount: number;
  coverageCities: number;
  cityBreakdown: {
    city: string;
    permitsToday: number;
    permitsWeek: number;
    totalPermits: number;
    mappablePermits: number;
    mapPercent?: number;
    lastSyncAt: string | null;
    sourceLabel?: string;
    isRgm: boolean;
  }[];
  dataLayers: Record<string, number>;
  syncSummary?: {
    healthy: number;
    stale: number;
    critical: number;
    anomalies?: number;
    ok?: boolean;
  } | null;
  intelDatasets: number;
  rbqLicenses: number;
};

type CoverageStatus =
  | "LIVE_INDEXED"
  | "PARTIAL_INDEXED"
  | "DOCUMENT_ONLY"
  | "REGISTERED_NOT_SYNCED"
  | "BROKEN";

type InitialTruth = {
  registeredSources: number;
  indexedDatasets: number;
  searchableMunicipalities: number;
  monitoredCities: number;
  cities: { city: string; permitStatus: CoverageStatus; zoningStatus: CoverageStatus }[];
};

const STATUS_STYLES: Record<CoverageStatus, string> = {
  LIVE_INDEXED: "bg-emerald-500/20 text-emerald-300",
  PARTIAL_INDEXED: "bg-sky-500/20 text-sky-300",
  DOCUMENT_ONLY: "bg-amber-500/20 text-amber-300",
  REGISTERED_NOT_SYNCED: "bg-slate-500/20 text-slate-300",
  BROKEN: "bg-red-500/20 text-red-300",
};

export default function CoverageClient({ initialTruth }: { initialTruth?: InitialTruth | null }) {
  const t = useTranslations("coverage");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enCA;
  const [data, setData] = useState<CoverageData | null>(null);
  const statusByCity = new Map(
    (initialTruth?.cities ?? []).map((c) => [c.city, c.permitStatus]),
  );

  useEffect(() => {
    fetch("/api/coverage/public")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-slate-400">{t("subtitle")}</p>

      {initialTruth && (
        <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-300">
          {t("truthLine", {
            indexed: initialTruth.indexedDatasets,
            sources: initialTruth.registeredSources,
            searchable: initialTruth.searchableMunicipalities,
            monitored: initialTruth.monitoredCities,
          })}
        </p>
      )}

      <div className="mt-8">
        <QuebecCoverageBar />
      </div>

      {data && (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-2xl font-bold text-sky-300">{data.datasetCount}</p>
              <p className="text-sm text-slate-400">{t("datasets")}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-2xl font-bold text-sky-300">{data.coverageCities}</p>
              <p className="text-sm text-slate-400">{t("cities")}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-2xl font-bold text-emerald-300">{data.rbqLicenses.toLocaleString()}</p>
              <p className="text-sm text-slate-400">{t("rbqLicenses")}</p>
            </div>
          </div>

          {data.syncSummary && (
            <p className="mt-6 text-sm text-slate-500">
              {t("syncHealth", {
                healthy: data.syncSummary.healthy,
                stale: data.syncSummary.stale,
                critical: data.syncSummary.critical,
              })}
            </p>
          )}

          <h2 className="mt-10 text-lg font-semibold text-white">{t("cityTable")}</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                <tr>
                  <th className="px-4 py-3">{t("colCity")}</th>
                  <th className="px-4 py-3">{t("colStatus")}</th>
                  <th className="px-4 py-3">{t("colPermits")}</th>
                  <th className="px-4 py-3">{t("colMap")}</th>
                  <th className="px-4 py-3">{t("colWeek")}</th>
                  <th className="px-4 py-3">{t("colSync")}</th>
                </tr>
              </thead>
              <tbody>
                {data.cityBreakdown.map((row) => (
                  <tr key={row.city} className="border-b border-slate-800/80">
                    <td className="px-4 py-3 font-medium text-white">
                      {row.city}
                      {row.isRgm && (
                        <span className="ml-2 text-[10px] uppercase text-sky-400">RMM</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {statusByCity.has(row.city) ? (
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[statusByCity.get(row.city)!]}`}>
                          {statusByCity.get(row.city)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.totalPermits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.mapPercent ?? 0}%
                      <span className="text-slate-500">
                        {" "}
                        ({row.mappablePermits}/{row.totalPermits})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.permitsWeek}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {row.lastSyncAt
                        ? formatDistanceToNow(new Date(row.lastSyncAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            <Link href="/developers" className="text-sky-400 hover:underline">
              {t("apiLink")}
            </Link>
            {" · "}
            <Link href="/intelligence" className="text-sky-400 hover:underline">
              {t("intelLink")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
