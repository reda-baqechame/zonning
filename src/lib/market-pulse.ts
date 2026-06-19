import { addDays, getDay, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { HIGH_VALUE_THRESHOLD } from "@/lib/format-cad";
import {
  CITY_TO_PERMIT_DATASET,
  RGM_CITIES,
  QUEBEC_INTEL_REFRESH_IDS,
} from "@/lib/quebec-coverage";
import { COVERAGE_CITIES, getDatasetCount } from "@/lib/datasets/registry";

export type CityPulseRow = {
  city: string;
  permitsToday: number;
  permitsWeek: number;
  totalPermits: number;
  mappablePermits: number;
  lastSyncAt: string | null;
  datasetId: string | null;
  isRgm: boolean;
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
  const permitStates = await prisma.syncState.findMany({
    where: {
      datasetId: {
        in: Object.values(CITY_TO_PERMIT_DATASET).filter(Boolean) as string[],
      },
    },
  });
  const stateByDataset = new Map(permitStates.map((s) => [s.datasetId, s]));

  return Promise.all(
    COVERAGE_CITIES.map(async (city) => {
      const [permitsToday, permitsWeek, totalPermits, mappablePermits] = await Promise.all([
        prisma.permit.count({ where: { city, issueDate: { gte: todayStart } } }),
        prisma.permit.count({ where: { city, issueDate: { gte: weekStart } } }),
        prisma.permit.count({ where: { city } }),
        prisma.permit.count({
          where: { city, latitude: { not: null }, longitude: { not: null } },
        }),
      ]);
      const datasetId = CITY_TO_PERMIT_DATASET[city];
      const state = datasetId ? stateByDataset.get(datasetId) : null;
      return {
        city,
        permitsToday,
        permitsWeek,
        totalPermits,
        mappablePermits,
        lastSyncAt: state?.lastSuccessAt?.toISOString() ?? null,
        datasetId,
        isRgm: (RGM_CITIES as readonly string[]).includes(city),
      };
    })
  );
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

export async function fetchMarketPulseStats(): Promise<MarketPulseStats> {
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
    coverageCities: COVERAGE_CITIES.length,
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

export { HIGH_VALUE_THRESHOLD } from "@/lib/format-cad";
