import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/datasets/parser";
import { haversineKm } from "@/lib/datasets/geo";
import { resolveCoordinatesForAddress } from "@/lib/geocode";
import {
  findContaminatedNearby,
  findHeritageNearby,
  findNearestZoningPoint,
} from "@/lib/spatial";

export type SiteIntelligenceLayers = {
  pum2050?: boolean;
  gtc?: boolean;
  lpc?: boolean;
  regionalZoning?: boolean;
};

export type PropertyIntelligence = {
  matricule?: string | null;
  layers?: SiteIntelligenceLayers;
  assessment?: {
    totalValue?: number | null;
    landValue?: number | null;
    buildingValue?: number | null;
    yearBuilt?: number | null;
    units?: number | null;
    floors?: number | null;
  };
  recentTransaction?: {
    salePrice?: number | null;
    saleDate?: string | null;
    buildingType?: string | null;
  };
  contamination?: {
    nearby: boolean;
    count: number;
    nearestStatus?: string | null;
    gtcNearby?: boolean;
    gtcCount?: number;
  };
  propertyTax?: {
    amount?: number | null;
    year?: number | null;
  };
  commercialVacancyNearby?: number;
  zoning?: {
    densityZone?: string | null;
    maxFloors?: number | null;
    description?: string | null;
    intensificationLevel?: string | null;
    landUse?: string | null;
    source?: "pum2050" | "legacy" | "regional";
  };
  heritage?: {
    nearby: boolean;
    count: number;
    hasEip: boolean;
    lpcProtected?: boolean;
    pum2050Listed?: boolean;
    nearestName?: string | null;
  };
  permitDelays?: {
    borough?: string;
    medianDays?: number | null;
    targetDays?: number | null;
    period?: string | null;
  };
  roadworks?: {
    nearby: boolean;
    count: number;
  };
  municipalContracts?: {
    supplierMatches: number;
    totalAmount: number;
  };
  marketHeat?: {
    permitCount: number;
    level: "hot" | "warm" | "cool";
    estimatedCostTotal?: number | null;
  };
  developmentProjects?: {
    nearby: boolean;
    count: number;
  };
  rbqInfraction?: {
    found: boolean;
    description?: string | null;
  };
  municipalInspection?: {
    found: boolean;
    violationType?: string | null;
  };
};

async function nearestZoningPoint(
  lat: number,
  lng: number,
  city?: string,
  maxKm = 0.25
) {
  return findNearestZoningPoint(lat, lng, city, maxKm);
}

export async function getIntelligenceForPermit(permit: {
  matricule?: string | null;
  address: string;
  borough?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  applicantName?: string | null;
}): Promise<PropertyIntelligence> {
  const intel: PropertyIntelligence = {
    matricule: permit.matricule,
    layers: {},
  };

  if (permit.matricule) {
    const unit = await prisma.propertyUnit.findUnique({
      where: { matricule: permit.matricule },
    });
    if (unit) {
      intel.assessment = {
        totalValue: unit.totalValue,
        landValue: unit.landValue,
        buildingValue: unit.buildingValue,
        yearBuilt: unit.yearBuilt,
        units: unit.units,
        floors: unit.floors,
      };
    }

    const txn = await prisma.propertyTransaction.findFirst({
      where: { matricule: permit.matricule },
      orderBy: { saleDate: "desc" },
    });
    if (txn) {
      intel.recentTransaction = {
        salePrice: txn.salePrice,
        saleDate: txn.saleDate?.toISOString() ?? null,
        buildingType: txn.buildingType,
      };
    }

    const tax = await prisma.propertyTax.findFirst({
      where: { matricule: permit.matricule },
      orderBy: { year: "desc" },
    });
    if (tax) {
      intel.propertyTax = { amount: tax.taxAmount, year: tax.year };
    }
  }

  if (!intel.assessment && permit.borough) {
    const norm = normalizeAddress(permit.address);
    const streetPart = norm.split(" ").slice(1).join(" ");
    if (streetPart.length > 4) {
      const unit = await prisma.propertyUnit.findFirst({
        where: {
          borough: permit.borough,
          address: { contains: streetPart.slice(0, 12) },
        },
      });
      if (unit) {
        intel.matricule = unit.matricule;
        intel.assessment = {
          totalValue: unit.totalValue,
          landValue: unit.landValue,
          buildingValue: unit.buildingValue,
          yearBuilt: unit.yearBuilt,
          units: unit.units,
        };
      }
    }
  }

  if (permit.latitude && permit.longitude) {
    const [mtlNearby, gtcNearby] = await Promise.all([
      findContaminatedNearby(permit.latitude, permit.longitude, 0.5, {
        sourceLayer: "mtl",
        borough: permit.borough ?? undefined,
        limit: 30,
      }),
      findContaminatedNearby(permit.latitude, permit.longitude, 0.5, {
        sourceLayer: "gtc",
        limit: 30,
      }),
    ]);

    intel.contamination = {
      nearby: mtlNearby.length > 0 || gtcNearby.length > 0,
      count: mtlNearby.length + gtcNearby.length,
      nearestStatus: gtcNearby[0]?.status ?? mtlNearby[0]?.status ?? null,
      gtcNearby: gtcNearby.length > 0,
      gtcCount: gtcNearby.length,
    };
    if (gtcNearby.length > 0) intel.layers!.gtc = true;

    const vacancies = await prisma.commercialVacancy.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(permit.borough ? { borough: permit.borough } : {}),
      },
      take: 100,
    });

    intel.commercialVacancyNearby = vacancies.filter((v) => {
      if (v.latitude == null || v.longitude == null) return false;
      return haversineKm(permit.latitude!, permit.longitude!, v.latitude, v.longitude) < 0.3;
    }).length;

    const zoningCity = permit.city ?? "Montréal";
    const zoningPoint = await nearestZoningPoint(
      permit.latitude,
      permit.longitude,
      zoningCity
    );
    if (zoningPoint) {
      intel.layers!.pum2050 = zoningCity === "Montréal";
      intel.layers!.regionalZoning = zoningCity !== "Montréal";
      intel.zoning = {
        densityZone: zoningPoint.landUse,
        landUse: zoningPoint.landUse,
        intensificationLevel: zoningPoint.intensificationLevel,
        description: zoningPoint.description,
        maxFloors: zoningPoint.densityThreshold
          ? Math.round(zoningPoint.densityThreshold / 10)
          : undefined,
        source: zoningCity === "Montréal" ? "pum2050" : "regional",
      };
    }

    const heritageNearby = await findHeritageNearby(
      permit.latitude,
      permit.longitude,
      0.15,
      permit.borough ?? undefined,
      25
    );

    const hasEip = heritageNearby.some((h) => h.externalId?.startsWith("heritage-eip-"));
    const lpcProtected = heritageNearby.some((h) => h.category === "lpc");
    const pum2050Listed = heritageNearby.some((h) => h.category === "pum2050");

    intel.heritage = {
      nearby: heritageNearby.length > 0,
      count: heritageNearby.length,
      hasEip,
      lpcProtected,
      pum2050Listed,
      nearestName: heritageNearby[0]?.name ?? null,
    };
    if (lpcProtected) intel.layers!.lpc = true;

    const roadworks = await prisma.roadWork.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(permit.city ? { city: permit.city } : {}),
        ...(permit.borough ? { borough: permit.borough } : {}),
      },
      take: 200,
    });

    const roadNearby = roadworks.filter((r) => {
      if (r.latitude == null || r.longitude == null) return false;
      return haversineKm(permit.latitude!, permit.longitude!, r.latitude, r.longitude) < 0.4;
    });

    intel.roadworks = {
      nearby: roadNearby.length > 0,
      count: roadNearby.length,
    };

    const projects = await prisma.developmentProject.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(permit.city ? { city: permit.city } : {}),
      },
      take: 100,
    });

    const projectNearby = projects.filter((p) => {
      if (p.latitude == null || p.longitude == null) return false;
      return haversineKm(permit.latitude!, permit.longitude!, p.latitude, p.longitude) < 1;
    });

    if (projectNearby.length > 0) {
      intel.developmentProjects = {
        nearby: true,
        count: projectNearby.length,
      };
    }
  } else if (permit.borough) {
    const count = await prisma.contaminatedSite.count({
      where: { borough: permit.borough, sourceLayer: "mtl" },
    });
    intel.contamination = { nearby: count > 0, count, nearestStatus: null };

    const zoning = await prisma.boroughZoning.findFirst({
      where: { borough: { contains: permit.borough.slice(0, 12) } },
    });
    if (zoning) {
      intel.zoning = {
        densityZone: zoning.densityZone,
        maxFloors: zoning.maxFloors,
        description: zoning.description,
        source: "legacy",
      };
    }

    const stats = await prisma.boroughPermitStat.findMany({
      where: { borough: { contains: permit.borough.slice(0, 12) } },
      take: 50,
    });
    if (stats.length > 0) {
      const permitCount = stats.reduce((sum, s) => sum + (s.permitCount ?? 0), 0);
      const estimatedCostTotal = stats.reduce(
        (sum, s) => sum + (s.estimatedCost ?? 0),
        0
      );
      intel.marketHeat = {
        permitCount,
        estimatedCostTotal: estimatedCostTotal || null,
        level: permitCount >= 500 ? "hot" : permitCount >= 150 ? "warm" : "cool",
      };
    }

    const [heritageCount, roadCount] = await Promise.all([
      prisma.heritageSite.count({ where: { borough: permit.borough } }),
      prisma.roadWork.count({ where: { borough: permit.borough } }),
    ]);
    if (heritageCount > 0) {
      intel.heritage = { nearby: true, count: heritageCount, hasEip: false };
    }
    if (roadCount > 0) {
      intel.roadworks = { nearby: true, count: roadCount };
    }
  }

  if (permit.borough) {
    const delay = await prisma.boroughPermitDelay.findFirst({
      where: { borough: { contains: permit.borough.slice(0, 12) } },
      orderBy: { sourceFetchedAt: "desc" },
    });
    if (delay) {
      intel.permitDelays = {
        borough: delay.borough,
        medianDays: delay.medianDays,
        targetDays: delay.targetDays,
        period: delay.period ?? undefined,
      };
    }
  }

  if (permit.applicantName && permit.applicantName.length > 3) {
    const needle = permit.applicantName.slice(0, 24);
    const contracts = await prisma.municipalContract.findMany({
      where: { supplierName: { contains: needle } },
      take: 20,
    });
    if (contracts.length > 0) {
      intel.municipalContracts = {
        supplierMatches: contracts.length,
        totalAmount: contracts.reduce((sum, c) => sum + (c.amount ?? 0), 0),
      };
    }

    const infraction = await prisma.rbqInfraction.findFirst({
      where: { holderName: { contains: needle.slice(0, 12) } },
      orderBy: { sourceFetchedAt: "desc" },
    });
    if (infraction) {
      intel.rbqInfraction = { found: true, description: infraction.description };
    }
  }

  if (permit.city === "Montréal" && permit.address.length > 5) {
    const inspection = await prisma.municipalInspection.findFirst({
      where: { address: { contains: permit.address.slice(0, 14) } },
    });
    if (inspection) {
      intel.municipalInspection = {
        found: true,
        violationType: inspection.violationType,
      };
    }
  }

  return intel;
}

export async function getIntelligenceByMatricule(matricule: string) {
  const unit = await prisma.propertyUnit.findUnique({ where: { matricule } });
  if (!unit) return null;

  return getIntelligenceForPermit({
    matricule,
    address: unit.address ?? "",
    borough: unit.borough,
  });
}

export async function getIntelligenceByAddress(
  address: string,
  borough?: string,
  city?: string
) {
  const norm = normalizeAddress(address);
  const unit = await prisma.propertyUnit.findFirst({
    where: {
      ...(borough ? { borough } : {}),
      address: { contains: norm.slice(0, 20) },
    },
  });

  const coords = await resolveCoordinatesForAddress(address, borough, city);
  const resolvedCity = city ?? coords?.city ?? undefined;

  return getIntelligenceForPermit({
    matricule: unit?.matricule,
    address,
    borough: borough ?? unit?.borough,
    city: resolvedCity,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
  });
}
