/**
 * Runtime truth — the single source of honesty about what ZONNING can actually
 * serve right now, computed from the live database + registry + sync health.
 *
 * The product's core risk is a truth mismatch: copy says "17 cities / 30
 * datasets" while only a handful of municipalities have searchable permit
 * records and many sources are document-only or registered-but-not-synced.
 * Every public surface should render values from here instead of hardcoded
 * marketing numbers, and label coverage with an explicit status vocabulary.
 */
import { prisma } from "@/lib/prisma";
import {
  ALL_DATASET_IDS,
  COVERAGE_CITIES,
  getDatasetCount,
} from "@/lib/datasets/registry";
import { CITY_TO_PERMIT_DATASET } from "@/lib/quebec-coverage";
import { buildSyncHealthSummary } from "@/lib/sync/health-summary";
import { resolveDatabaseUrl, isPostgresUrl } from "@/lib/env-resolve";

/** Universal coverage status vocabulary used across the UI. */
export type CoverageStatus =
  | "LIVE_INDEXED" // dataset wired + meaningful searchable rows
  | "PARTIAL_INDEXED" // wired + some rows, but thin or weak mappability
  | "DOCUMENT_ONLY" // source exists but no structured/searchable records
  | "REGISTERED_NOT_SYNCED" // dataset configured, zero rows ingested
  | "BROKEN"; // wired but last sync failed with no data

const LIVE_PERMIT_THRESHOLD = 200;
const PARTIAL_PERMIT_THRESHOLD = 1;

export type CityCoverage = {
  city: string;
  permitDatasetId: string | null;
  permitCount: number;
  mappablePermits: number;
  mappablePercent: number;
  zoningPoints: number;
  permitStatus: CoverageStatus;
  zoningStatus: CoverageStatus;
};

export type RuntimeTruth = {
  // Source catalog vs. what's actually live.
  registeredSources: number; // every configured dataset/source
  indexedDatasets: number; // sources that produced searchable rows
  monitoredCities: number; // cities we track at all
  searchableMunicipalities: number; // cities with permit rows
  // Volume.
  totalPermits: number;
  mappablePermits: number;
  totalTenders: number;
  // Per-city honesty.
  cities: CityCoverage[];
  // Health.
  syncHealth: {
    ok: boolean;
    healthy: number;
    stale: number;
    critical: number;
    anomalies: number;
  };
  criticalDatasets: string[];
  staleDatasets: string[];
  // Infra.
  postgisEnabled: boolean;
  deploymentCronMode: string;
  databaseProvider: "postgres" | "sqlite";
  updatedAt: string;
};

export function permitStatus(
  datasetId: string | null,
  count: number,
  mappable: number,
): CoverageStatus {
  if (!datasetId) return "DOCUMENT_ONLY";
  if (count === 0) return "REGISTERED_NOT_SYNCED";
  if (count >= LIVE_PERMIT_THRESHOLD && mappable > 0) return "LIVE_INDEXED";
  if (count >= PARTIAL_PERMIT_THRESHOLD) return "PARTIAL_INDEXED";
  return "REGISTERED_NOT_SYNCED";
}

export function zoningStatus(points: number): CoverageStatus {
  if (points >= 50) return "PARTIAL_INDEXED";
  if (points > 0) return "PARTIAL_INDEXED";
  return "DOCUMENT_ONLY";
}

/** Best-effort read of the deployed cron configuration. */
export function getDeploymentCronMode(): string {
  if (process.env.SYNC_ENABLED === "false") return "disabled";
  // GitHub Actions fallback cron is independent of Vercel crons.
  if (process.env.VERCEL) return process.env.VERCEL_CRON_MODE ?? "vercel";
  return process.env.CRON_MODE ?? "external";
}

export async function buildRuntimeTruth(): Promise<RuntimeTruth> {
  const dbUrl = resolveDatabaseUrl();
  const isPg = isPostgresUrl(dbUrl ?? "");

  const [
    totalPermits,
    mappablePermits,
    totalTenders,
    permitsByCity,
    mappableByCity,
    zoningByCity,
    indexedStates,
    health,
  ] = await Promise.all([
    prisma.permit.count(),
    prisma.permit.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
    prisma.tender.count(),
    prisma.permit.groupBy({ by: ["city"], _count: { _all: true } }),
    prisma.permit.groupBy({
      by: ["city"],
      where: { latitude: { not: null }, longitude: { not: null } },
      _count: { _all: true },
    }),
    prisma.zoningPoint.groupBy({ by: ["city"], _count: { _all: true } }),
    // A dataset counts as "indexed" only once it has actually ingested rows.
    prisma.syncState.count({ where: { recordsProcessed: { gt: 0 }, lastSuccessAt: { not: null } } }),
    buildSyncHealthSummary({ authorized: true }),
  ]);

  const permitMap = new Map(permitsByCity.map((r) => [r.city, r._count._all]));
  const mappableMap = new Map(mappableByCity.map((r) => [r.city, r._count._all]));
  const zoningMap = new Map(zoningByCity.map((r) => [r.city, r._count._all]));

  const cities: CityCoverage[] = COVERAGE_CITIES.map((city) => {
    const datasetId = CITY_TO_PERMIT_DATASET[city] ?? null;
    const permitCount = permitMap.get(city) ?? 0;
    const mappable = mappableMap.get(city) ?? 0;
    const zoning = zoningMap.get(city) ?? 0;
    return {
      city,
      permitDatasetId: datasetId,
      permitCount,
      mappablePermits: mappable,
      mappablePercent: permitCount > 0 ? Math.round((mappable / permitCount) * 100) : 0,
      zoningPoints: zoning,
      permitStatus: permitStatus(datasetId, permitCount, mappable),
      zoningStatus: zoningStatus(zoning),
    };
  });

  const criticalDatasets = health.datasets
    .filter((d) => d.health === "critical")
    .map((d) => d.id);
  const staleDatasets = health.datasets.filter((d) => d.health === "stale").map((d) => d.id);

  return {
    registeredSources: ALL_DATASET_IDS.length,
    indexedDatasets: indexedStates || getDatasetCount(),
    monitoredCities: COVERAGE_CITIES.length,
    searchableMunicipalities: cities.filter((c) => c.permitCount > 0).length,
    totalPermits,
    mappablePermits,
    totalTenders,
    cities,
    syncHealth: {
      ok: health.ok,
      healthy: health.summary.healthy,
      stale: health.summary.stale,
      critical: health.summary.critical,
      anomalies: health.summary.anomalies,
    },
    criticalDatasets,
    staleDatasets,
    postgisEnabled: isPg && process.env.POSTGIS_ENABLED !== "false",
    deploymentCronMode: getDeploymentCronMode(),
    databaseProvider: isPg ? "postgres" : "sqlite",
    updatedAt: new Date().toISOString(),
  };
}

export type PublicRuntimeSummary = {
  registeredSources: number;
  indexedDatasets: number;
  monitoredCities: number;
  searchableMunicipalities: number;
  totalPermits: number;
  mappablePermits: number;
  totalTenders: number;
  /** Coarse, non-leaky health label. */
  syncHealth: "healthy" | "degraded" | "down";
  updatedAt: string;
};

/** Public-safe subset — no env, no dataset ids, no per-error detail. */
export async function buildPublicRuntimeSummary(): Promise<PublicRuntimeSummary> {
  const truth = await buildRuntimeTruth();
  const health: PublicRuntimeSummary["syncHealth"] = !truth.syncHealth.ok
    ? truth.syncHealth.critical > truth.syncHealth.healthy
      ? "down"
      : "degraded"
    : "healthy";

  return {
    registeredSources: truth.registeredSources,
    indexedDatasets: truth.indexedDatasets,
    monitoredCities: truth.monitoredCities,
    searchableMunicipalities: truth.searchableMunicipalities,
    totalPermits: truth.totalPermits,
    mappablePermits: truth.mappablePermits,
    totalTenders: truth.totalTenders,
    syncHealth: health,
    updatedAt: truth.updatedAt,
  };
}
