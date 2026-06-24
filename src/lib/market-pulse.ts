import { addDays, getDay, startOfDay, subDays } from "date-fns";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { HIGH_VALUE_THRESHOLD } from "@/lib/format-cad";
import {
  CITY_TO_PERMIT_DATASET,
  getPermitCoverageStatusForCity,
  RGM_CITIES,
  QUEBEC_INTEL_REFRESH_IDS,
  honestCoverageCount,
  citiesWithoutOpenFeed,
} from "@/lib/quebec-coverage";
import {
  COVERAGE_CITIES,
  getDatasetCount,
  getRegisteredSourceCount,
  type DatasetCoverageStatus,
} from "@/lib/datasets/registry";

export type CityPulseRow = {
  city: string;
  permitsToday: number;
  permitsWeek: number;
  totalPermits: number;
  mappablePermits: number;
  lastSyncAt: string | null;
  datasetId: string | null;
  isRgm: boolean;
  coverageStatus: DatasetCoverageStatus;
  coverageLabel: string;
  coverageNote: string | null;
  sourceUrl: string | null;
};

export type DataLayerCounts = {
  permits: number;
  tenders: number;
  rbq: number;
  zoning: number;
  transactions: number;
  assessment: number;
  heritage: number;
  contracts: number;
  contamination: number;
  roadworks: number;
  companies: number;
  awards: number;
};

export type MarketPulseStats = {
  permitsWeek: number;
  permitsToday: number;
  highValueWeek: number;
  tendersOpen: number;
  tendersClosingWeek: number;
  tendersClosingThursday: number;
  estimatedValueWeek: number;
  companies: number;
  rbqLicenses: number;
  heritage: number;
  contracts: number;
  permitsLastSuccessAt: string | null;
  datasetCount: number;
  coverageCities: number;
  uncoveredCities: string[];
  registeredSources: number;
  searchableMunicipalities: number;
  cities: string[];
  rgm: {
    permitsToday: number;
    permitsWeek: number;
    cities: CityPulseRow[];
  };
  cityBreakdown: CityPulseRow[];
  dataLayers: DataLayerCounts;
  intelDatasets: number;
  updatedAt: string;
};

async function fetchCityBreakdown(
  todayStart: Date,
  weekStart: Date
): Promise<CityPulseRow[]> {
  const coveredCities = [...COVERAGE_CITIES];
  const [permitStates, totals, todayCounts, weekCounts, mappableCounts] = await Promise.all([
    prisma.syncState.findMany({
      where: {
        datasetId: {
          in: Object.values(CITY_TO_PERMIT_DATASET).filter(Boolean) as string[],
        },
      },
    }),
    prisma.permit.groupBy({
      by: ["city"],
      where: { city: { in: coveredCities } },
      _count: { _all: true },
    }),
    prisma.permit.groupBy({
      by: ["city"],
      where: { city: { in: coveredCities }, issueDate: { gte: todayStart } },
      _count: { _all: true },
    }),
    prisma.permit.groupBy({
      by: ["city"],
      where: { city: { in: coveredCities }, issueDate: { gte: weekStart } },
      _count: { _all: true },
    }),
    prisma.permit.groupBy({
      by: ["city"],
      where: {
        city: { in: coveredCities },
        latitude: { not: null },
        longitude: { not: null },
      },
      _count: { _all: true },
    }),
  ]);

  const stateByDataset = new Map(permitStates.map((s) => [s.datasetId, s]));
  const toCountMap = (rows: Array<{ city: string; _count: { _all: number } }>) =>
    new Map(rows.map((row) => [row.city, row._count._all]));
  const totalByCity = toCountMap(totals);
  const todayByCity = toCountMap(todayCounts);
  const weekByCity = toCountMap(weekCounts);
  const mappableByCity = toCountMap(mappableCounts);

  return COVERAGE_CITIES.map((city) => {
    const coverage = getPermitCoverageStatusForCity(city);
    const datasetId = CITY_TO_PERMIT_DATASET[city];
    const state = datasetId ? stateByDataset.get(datasetId) : null;
    return {
      city,
      permitsToday: todayByCity.get(city) ?? 0,
      permitsWeek: weekByCity.get(city) ?? 0,
      totalPermits: totalByCity.get(city) ?? 0,
      mappablePermits: mappableByCity.get(city) ?? 0,
      lastSyncAt: state?.lastSuccessAt?.toISOString() ?? null,
      datasetId,
      isRgm: (RGM_CITIES as readonly string[]).includes(city),
      coverageStatus: coverage.status,
      coverageLabel: coverage.label,
      coverageNote: coverage.note,
      sourceUrl: coverage.sourceUrl,
    };
  });
}

async function fetchDataLayerCounts(): Promise<DataLayerCounts> {
  const [
    permits,
    tenders,
    rbq,
    zoning,
    transactions,
    assessment,
    heritage,
    contracts,
    contamination,
    roadworks,
    companies,
    awards,
  ] = await Promise.all([
    prisma.permit.count(),
    prisma.tender.count(),
    prisma.rbqLicense.count({ where: { status: "active" } }),
    prisma.zoningPoint.count(),
    prisma.propertyTransaction.count(),
    prisma.propertyUnit.count(),
    prisma.heritageSite.count(),
    prisma.municipalContract.count(),
    prisma.contaminatedSite.count(),
    prisma.roadWork.count(),
    prisma.company.count(),
    prisma.tenderAward.count(),
  ]);

  return {
    permits,
    tenders,
    rbq,
    zoning,
    transactions,
    assessment,
    heritage,
    contracts,
    contamination,
    roadworks,
    companies,
    awards,
  };
}

async function loadMarketPulseStats(): Promise<MarketPulseStats> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = subDays(now, 7);
  const weekEnd = addDays(now, 7);

  const [
    permitsWeek,
    permitsToday,
    highValueWeek,
    tendersOpen,
    tendersClosingWeek,
    thursdayTenders,
    valueAgg,
    companies,
    rbqLicenses,
    heritage,
    contracts,
    permitState,
    cityBreakdown,
    dataLayers,
  ] = await Promise.all([
    prisma.permit.count({ where: { issueDate: { gte: weekStart } } }),
    prisma.permit.count({ where: { issueDate: { gte: todayStart } } }),
    prisma.permit.count({
      where: { issueDate: { gte: weekStart }, estimatedCost: { gte: HIGH_VALUE_THRESHOLD } },
    }),
    prisma.tender.count({
      where: {
        closesAt: { gte: now },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
    }),
    prisma.tender.count({
      where: {
        closesAt: { gte: now, lte: weekEnd },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
    }),
    prisma.tender.findMany({
      where: {
        closesAt: { gte: now },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
      select: { closesAt: true },
      take: 500,
    }),
    prisma.permit.aggregate({
      where: { issueDate: { gte: weekStart }, estimatedCost: { not: null } },
      _sum: { estimatedCost: true },
    }),
    prisma.company.count(),
    prisma.rbqLicense.count({ where: { status: "active" } }),
    prisma.heritageSite.count(),
    prisma.municipalContract.count(),
    prisma.syncState.findUnique({ where: { datasetId: "permits" } }),
    fetchCityBreakdown(todayStart, weekStart),
    fetchDataLayerCounts(),
  ]);

  const tendersClosingThursday = thursdayTenders.filter(
    (t) => t.closesAt && getDay(t.closesAt) === 4
  ).length;

  const rgmRows = cityBreakdown.filter((c) => c.isRgm);

  return {
    permitsWeek,
    permitsToday,
    highValueWeek,
    tendersOpen,
    tendersClosingWeek,
    tendersClosingThursday,
    estimatedValueWeek: valueAgg._sum.estimatedCost ?? 0,
    companies,
    rbqLicenses,
    heritage,
    contracts,
    permitsLastSuccessAt: permitState?.lastSuccessAt?.toISOString() ?? null,
    datasetCount: getDatasetCount(),
    coverageCities: honestCoverageCount(),
    uncoveredCities: citiesWithoutOpenFeed(),
    registeredSources: getRegisteredSourceCount(),
    searchableMunicipalities: cityBreakdown.filter((city) => city.totalPermits > 0).length,
    cities: [...COVERAGE_CITIES],
    rgm: {
      permitsToday: rgmRows.reduce((s, c) => s + c.permitsToday, 0),
      permitsWeek: rgmRows.reduce((s, c) => s + c.permitsWeek, 0),
      cities: rgmRows,
    },
    cityBreakdown,
    dataLayers,
    intelDatasets: QUEBEC_INTEL_REFRESH_IDS.length,
    updatedAt: now.toISOString(),
  };
}

export const fetchMarketPulseStats = unstable_cache(
  loadMarketPulseStats,
  ["market-pulse-stats-v1"],
  { revalidate: 30, tags: ["market-pulse"] }
);

export { HIGH_VALUE_THRESHOLD } from "@/lib/format-cad";
