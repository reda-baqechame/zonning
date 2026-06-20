"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { enCA, fr } from "date-fns/locale";
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
    coverageStatus?: string;
    coverageLabel?: string;
    coverageNote?: string | null;
    sourceUrl?: string | null;
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
  registered?: {
    id: string;
    label: string;
    status: string;
    syncEnabled: boolean;
    note: string | null;
    sourceUrl?: string | null;
  }[];
  intelDatasets: number;
  rbqLicenses: number;
};

function statusTone(status?: string) {
  if (status === "authoritative") return "bg-success-soft text-success";
  if (status === "partial") return "bg-warning-soft text-warning";
  if (status === "stale" || status === "blocked") return "bg-danger-soft text-danger";
  return "bg-surface-2 text-subtle";
}

export default function CoverageClient() {
  const t = useTranslations("coverage");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enCA;
  const [data, setData] = useState<CoverageData | null>(null);

  useEffect(() => {
    fetch("/api/coverage/public")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 text-ink">
      <h1 className="text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      <div className="mt-8">
        <QuebecCoverageBar />
      </div>

      {data && (
        <>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-2xl font-bold text-brand">{data.datasetCount}</p>
              <p className="text-sm text-muted">{t("datasets")}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-2xl font-bold text-brand">{data.coverageCities}</p>
              <p className="text-sm text-muted">{t("cities")}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
              <p className="text-2xl font-bold text-success">{data.rbqLicenses.toLocaleString()}</p>
              <p className="text-sm text-muted">{t("rbqLicenses")}</p>
            </div>
          </div>

          {data.syncSummary && (
            <p className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">
              {t("syncHealth", {
                healthy: data.syncSummary.healthy,
                stale: data.syncSummary.stale,
                critical: data.syncSummary.critical,
              })}
            </p>
          )}

          <h2 className="mt-10 text-lg font-semibold text-ink">{t("cityTable")}</h2>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-subtle">
                <tr>
                  <th className="px-4 py-3">{t("colCity")}</th>
                  <th className="px-4 py-3">{t("colPermits")}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">{t("colMap")}</th>
                  <th className="px-4 py-3">{t("colWeek")}</th>
                  <th className="px-4 py-3">{t("colSync")}</th>
                </tr>
              </thead>
              <tbody>
                {data.cityBreakdown.map((row) => (
                  <tr key={row.city} className="border-b border-line/80 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {row.city}
                      {row.isRgm && (
                        <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] uppercase text-brand">
                          RMM
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.totalPermits.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${statusTone(row.coverageStatus)}`}>
                        {row.coverageStatus ?? "unknown"}
                      </span>
                      {row.coverageNote && (
                        <p className="mt-1 max-w-xs text-xs text-subtle">{row.coverageNote}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {row.mapPercent ?? 0}%
                      <span className="text-subtle">
                        {" "}
                        ({row.mappablePermits}/{row.totalPermits})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{row.permitsWeek}</td>
                    <td className="px-4 py-3 text-subtle">
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

          {data.registered?.length ? (
            <>
              <h2 className="mt-10 text-lg font-semibold text-ink">Connector status</h2>
              <p className="mt-1 max-w-3xl text-sm text-muted">
                Registered sources are shown honestly. Document-only and disabled connectors are not counted as live coverage.
              </p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-surface shadow-sm">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-line bg-surface-2 text-subtle">
                    <tr>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Sync</th>
                      <th className="px-4 py-3">Limitation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.registered.slice(0, 30).map((source) => (
                      <tr key={source.id} className="border-b border-line/80 last:border-0">
                        <td className="px-4 py-3">
                          {source.sourceUrl ? (
                            <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                              {source.label}
                            </a>
                          ) : (
                            <span className="font-medium text-ink">{source.label}</span>
                          )}
                          <p className="text-xs text-subtle">{source.id}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-wide ${statusTone(source.status)}`}>
                            {source.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{source.syncEnabled ? "Scheduled" : "Document only"}</td>
                        <td className="px-4 py-3 text-subtle">{source.note ?? "No limitation published yet."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          <p className="mt-8 text-sm text-subtle">
            <Link href="/developers" className="text-brand hover:underline">
              {t("apiLink")}
            </Link>
            {" · "}
            <Link href="/intelligence" className="text-brand hover:underline">
              {t("intelLink")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
