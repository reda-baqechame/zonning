import type { PropertyIntelligence } from "@/lib/intelligence";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

export type PipelineScoreInput = {
  permitType: string;
  workType?: string | null;
  borough?: string | null;
  estimatedCost?: number | null;
  issueDate?: Date | null;
};

export type PipelineScoreResult = {
  score: number;
  breakdown: {
    rbqFit: number;
    costFit: number;
    competition: number;
    intelligence: number;
    zoning: number;
  };
  competitionCount: number;
  densityGap?: "upside" | "at_capacity" | "unknown";
  densityGapLabelFr?: string;
  densityGapLabelEn?: string;
};

export async function getCompetitionDensity(
  permitType: string,
  borough?: string | null,
  days = 90
): Promise<number> {
  const since = subDays(new Date(), days);
  const count = await prisma.permit.count({
    where: {
      issueDate: { gte: since },
      ...(borough ? { borough } : {}),
      OR: [
        { permitType: { contains: permitType.slice(0, 8) } },
        { workType: { contains: permitType.slice(0, 8) } },
      ],
    },
  });
  return count;
}

function scoreCostFit(
  estimatedCost: number | null | undefined,
  minCost?: number | null,
  maxCost?: number | null
): number {
  if (!estimatedCost) return 50;
  const min = minCost ?? 50_000;
  const max = maxCost ?? 5_000_000;
  if (estimatedCost >= min && estimatedCost <= max) return 100;
  if (estimatedCost < min) return Math.max(20, 100 - ((min - estimatedCost) / min) * 60);
  return Math.max(20, 100 - ((estimatedCost - max) / max) * 60);
}

function scoreCompetition(count: number): number {
  if (count <= 3) return 100;
  if (count <= 10) return 80;
  if (count <= 25) return 60;
  if (count <= 50) return 40;
  return 20;
}

function scoreIntelligence(intel?: PropertyIntelligence): number {
  if (!intel) return 50;
  let score = 60;
  if (intel.assessment?.totalValue && intel.assessment.totalValue > 500_000) score += 15;
  if (intel.contamination?.gtcNearby) score -= 30;
  else if (intel.contamination?.nearby) score -= 25;
  if (intel.heritage?.lpcProtected) score -= 22;
  else if (intel.heritage?.pum2050Listed) score -= 15;
  else if (intel.heritage?.hasEip) score -= 20;
  else if (intel.heritage?.nearby) score -= 12;
  if (intel.roadworks?.nearby) score -= 5;
  if (intel.developmentProjects?.nearby) score += 6;
  if (
    intel.permitDelays?.medianDays != null &&
    intel.permitDelays.targetDays != null &&
    intel.permitDelays.medianDays > intel.permitDelays.targetDays
  ) {
    score -= 8;
  }
  if (intel.municipalContracts?.supplierMatches) score += 8;
  if (intel.marketHeat?.level === "hot") score += 10;
  if (intel.recentTransaction?.salePrice) score += 10;
  if (intel.zoning?.source === "pum2050") score += 5;
  return Math.max(0, Math.min(100, score));
}

function scoreZoning(intel?: PropertyIntelligence): number {
  if (!intel?.zoning) return 50;
  if (intel.zoning.source === "pum2050") {
    const level = intel.zoning.intensificationLevel?.toLowerCase() ?? "";
    if (level.includes("élev") || level.includes("fort")) return 90;
    if (level.includes("moy")) return 75;
    return 65;
  }
  const max = intel.zoning.maxFloors ?? 0;
  if (max >= 6) return 85;
  if (max >= 4) return 70;
  return 55;
}

export function computeDensityGap(
  intel?: PropertyIntelligence
): Pick<PipelineScoreResult, "densityGap" | "densityGapLabelFr" | "densityGapLabelEn"> {
  const intensification = intel?.zoning?.intensificationLevel?.toLowerCase();
  const maxFloors = intel?.zoning?.maxFloors;
  const builtFloors = intel?.assessment?.floors ?? 0;

  if (intensification?.includes("élev") || intensification?.includes("fort")) {
    return {
      densityGap: "upside",
      densityGapLabelFr: "Zone à intensification élevée (PUM 2050)",
      densityGapLabelEn: "High intensification zone (PUM 2050)",
    };
  }

  if (!maxFloors) {
    return { densityGap: "unknown" };
  }

  if (builtFloors >= maxFloors) {
    return {
      densityGap: "at_capacity",
      densityGapLabelFr: "À pleine capacité (PUM 2050)",
      densityGapLabelEn: "At full capacity (PUM 2050)",
    };
  }

  return {
    densityGap: "upside",
    densityGapLabelFr: `Marge de densité possible (${builtFloors}/${maxFloors} étages)`,
    densityGapLabelEn: `Density upside possible (${builtFloors}/${maxFloors} floors)`,
  };
}

export async function computePipelineScore(
  permit: PipelineScoreInput,
  user: {
    rbqLicenseClass?: string | null;
    rbqLicenseNumber?: string | null;
    rbqVerified?: boolean;
    minProjectCost?: number | null;
    maxProjectCost?: number | null;
  },
  intel?: PropertyIntelligence,
  options?: { competitionCount?: number }
): Promise<PipelineScoreResult> {
  const rbq = computeVerifiedRbqFit(
    user.rbqLicenseClass,
    user.rbqLicenseNumber,
    user.rbqVerified ?? false,
    permit.permitType,
    permit.workType
  );

  const competitionCount =
    options?.competitionCount ??
    (await getCompetitionDensity(permit.permitType, permit.borough));

  const rbqFit = rbq.score;
  const costFit = scoreCostFit(permit.estimatedCost, user.minProjectCost, user.maxProjectCost);
  const competition = scoreCompetition(competitionCount);
  const intelligence = scoreIntelligence(intel);
  const zoning = scoreZoning(intel);

  const score = Math.round(
    rbqFit * 0.4 +
      costFit * 0.2 +
      competition * 0.15 +
      intelligence * 0.15 +
      zoning * 0.1
  );

  const densityGapInfo = computeDensityGap(intel);

  return {
    score,
    breakdown: { rbqFit, costFit, competition, intelligence, zoning },
    competitionCount,
    ...densityGapInfo,
  };
}
