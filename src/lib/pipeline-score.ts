import { differenceInCalendarDays, subDays } from "date-fns";
import type { PropertyIntelligence } from "@/lib/intelligence";
import { hasIntelligenceData } from "@/lib/intelligence";
import { prisma } from "@/lib/prisma";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { classifyContractorPermit } from "@/lib/contractor-fit";

export type RankingConfidence = "low" | "medium" | "high";

export type RankingReason = {
  id:
    | "verified_rbq_match"
    | "rbq_mismatch"
    | "cost_in_range"
    | "cost_outside_range"
    | "fresh_record"
    | "stale_record"
    | "active_market"
    | "site_upside"
    | "site_constraints"
    | "trade_match"
    | "trade_mismatch"
    | "region_match"
    | "amp_blocked"
    | "bid_window"
    | "limited_evidence";
  impact: "positive" | "warning" | "info";
};

export type PipelineScoreInput = {
  permitType: string;
  workType?: string | null;
  borough?: string | null;
  estimatedCost?: number | null;
  issueDate?: Date | null;
};

export type PipelineScoreResult = {
  score: number;
  fitScore: number;
  confidence: number;
  confidenceLevel: RankingConfidence;
  recordQualityScore?: number;
  breakdown: {
    rbqFit: number | null;
    costFit: number | null;
    marketActivity: number;
    freshness: number | null;
    intelligence: number | null;
    zoning: number | null;
  };
  marketActivityCount: number;
  reasons: RankingReason[];
  missingEvidence: string[];
  densityGap?: "upside" | "at_capacity" | "unknown";
  densityGapLabelFr?: string;
  densityGapLabelEn?: string;
};

export type ScoreComponent = {
  score: number | null;
  weight: number;
  evidenceWeight: number;
  missingId: string;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceLevel(confidence: number): RankingConfidence {
  if (confidence >= 80) return "high";
  if (confidence >= 55) return "medium";
  return "low";
}

export function combineRankingComponents(components: ScoreComponent[]) {
  const available = components.filter(
    (component): component is ScoreComponent & { score: number } =>
      component.score !== null,
  );
  const totalWeight = available.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const fitScore = totalWeight
    ? clampScore(
        available.reduce(
          (sum, component) => sum + component.score * component.weight,
          0,
        ) / totalWeight,
      )
    : 0;
  const confidence = clampScore(
    available.reduce((sum, component) => sum + component.evidenceWeight, 0),
  );
  const score = clampScore(fitScore * (0.55 + confidence * 0.0045));

  return {
    score,
    fitScore,
    confidence,
    confidenceLevel: confidenceLevel(confidence),
    missingEvidence: components
      .filter((component) => component.score === null)
      .map((component) => component.missingId),
  };
}

export async function getCompetitionDensity(
  permitType: string,
  borough?: string | null,
  days = 90,
): Promise<number> {
  const since = subDays(new Date(), days);
  return prisma.permit.count({
    where: {
      issueDate: { gte: since },
      ...(borough ? { borough } : {}),
      OR: [
        { permitType: { contains: permitType.slice(0, 8) } },
        { workType: { contains: permitType.slice(0, 8) } },
      ],
    },
  });
}

export function scoreCostFit(
  estimatedCost: number | null | undefined,
  minCost?: number | null,
  maxCost?: number | null,
): number | null {
  if (
    !estimatedCost ||
    estimatedCost <= 0 ||
    (minCost == null && maxCost == null)
  ) {
    return null;
  }
  const min = Math.max(0, minCost ?? 0);
  const max = maxCost && maxCost > 0 ? maxCost : Number.POSITIVE_INFINITY;
  if (estimatedCost >= min && estimatedCost <= max) return 100;
  if (estimatedCost < min && min > 0) {
    return clampScore(Math.max(15, 100 - ((min - estimatedCost) / min) * 80));
  }
  if (Number.isFinite(max)) {
    return clampScore(Math.max(15, 100 - ((estimatedCost - max) / max) * 80));
  }
  return 100;
}

export function scoreMarketActivity(count: number): number {
  if (count <= 0) return 20;
  if (count <= 2) return 45;
  if (count <= 10) return 75;
  if (count <= 30) return 100;
  if (count <= 75) return 85;
  return 70;
}

export function scoreFreshness(
  issueDate: Date | null | undefined,
  now = new Date(),
): number | null {
  if (!issueDate || Number.isNaN(issueDate.getTime())) return null;
  const ageDays = differenceInCalendarDays(now, issueDate);
  if (ageDays < -1) return 20;
  if (ageDays <= 3) return 100;
  if (ageDays <= 7) return 95;
  if (ageDays <= 14) return 85;
  if (ageDays <= 30) return 70;
  if (ageDays <= 60) return 50;
  if (ageDays <= 90) return 35;
  return 15;
}

function scoreIntelligence(intel?: PropertyIntelligence): number | null {
  if (!intel || !hasIntelligenceData(intel)) return null;
  let score = 65;
  if ((intel.assessment?.totalValue ?? 0) > 500_000) score += 10;
  if (intel.contamination?.gtcNearby) score -= 15;
  else if (intel.contamination?.nearby) score -= 10;
  if (intel.heritage?.lpcProtected) score -= 12;
  else if (intel.heritage?.pum2050Listed) score -= 8;
  else if (intel.heritage?.hasEip) score -= 10;
  else if (intel.heritage?.nearby) score -= 5;
  if (intel.roadworks?.nearby) score -= 5;
  if (intel.developmentProjects?.nearby) score += 8;
  if (
    intel.permitDelays?.medianDays != null &&
    intel.permitDelays.targetDays != null &&
    intel.permitDelays.medianDays > intel.permitDelays.targetDays
  ) {
    score -= 10;
  }
  if (intel.municipalContracts?.supplierMatches) score += 8;
  if (intel.marketHeat?.level === "hot") score += 8;
  if (intel.recentTransaction?.salePrice) score += 8;
  if (intel.rbqInfraction?.found) score -= 20;
  if (intel.municipalInspection?.found) score -= 18;
  return clampScore(score);
}

function scoreZoning(intel?: PropertyIntelligence): number | null {
  if (!intel?.zoning) return null;
  if (
    intel.zoning.determination !== "confirmed" ||
    intel.zoning.evidenceScope !== "parcel"
  ) {
    return null;
  }
  const max = intel.zoning.maxFloors;
  if (max == null) return 55;
  if (max >= 6) return 85;
  if (max >= 4) return 70;
  return 55;
}

export function computeDensityGap(
  intel?: PropertyIntelligence,
): Pick<
  PipelineScoreResult,
  "densityGap" | "densityGapLabelFr" | "densityGapLabelEn"
> {
  const maxFloors = intel?.zoning?.maxFloors;
  const builtFloors = intel?.assessment?.floors;

  if (
    intel?.zoning?.determination !== "confirmed" ||
    intel.zoning.evidenceScope !== "parcel" ||
    !maxFloors ||
    builtFloors == null
  ) {
    return { densityGap: "unknown" };
  }
  if (builtFloors >= maxFloors) {
    return {
      densityGap: "at_capacity",
      densityGapLabelFr: "Capacité réglementaire apparente atteinte",
      densityGapLabelEn: "Apparent regulatory capacity reached",
    };
  }
  return {
    densityGap: "upside",
    densityGapLabelFr: `Marge de densité possible (${builtFloors}/${maxFloors} étages)`,
    densityGapLabelEn: `Density upside possible (${builtFloors}/${maxFloors} floors)`,
  };
}

function buildReasons(input: {
  rbqFit: number | null;
  rbqEligible: boolean;
  costFit: number | null;
  freshness: number | null;
  marketActivity: number;
  intelligence: number | null;
  densityGap?: PipelineScoreResult["densityGap"];
  confidence: number;
}): RankingReason[] {
  const reasons: RankingReason[] = [];
  if (input.rbqEligible && (input.rbqFit ?? 0) >= 90) {
    reasons.push({ id: "verified_rbq_match", impact: "positive" });
  } else if (input.rbqFit !== null && input.rbqFit < 40) {
    reasons.push({ id: "rbq_mismatch", impact: "warning" });
  }
  if ((input.costFit ?? 0) >= 90) {
    reasons.push({ id: "cost_in_range", impact: "positive" });
  } else if (input.costFit !== null && input.costFit < 50) {
    reasons.push({ id: "cost_outside_range", impact: "warning" });
  }
  if ((input.freshness ?? 0) >= 85) {
    reasons.push({ id: "fresh_record", impact: "positive" });
  } else if (input.freshness !== null && input.freshness <= 35) {
    reasons.push({ id: "stale_record", impact: "warning" });
  }
  if (input.marketActivity >= 75) {
    reasons.push({ id: "active_market", impact: "positive" });
  }
  if (input.densityGap === "upside") {
    reasons.push({ id: "site_upside", impact: "positive" });
  }
  if (input.intelligence !== null && input.intelligence < 45) {
    reasons.push({ id: "site_constraints", impact: "warning" });
  }
  if (input.confidence < 55) {
    reasons.push({ id: "limited_evidence", impact: "info" });
  }
  const priority = { warning: 0, positive: 1, info: 2 } as const;
  return reasons
    .toSorted((a, b) => priority[a.impact] - priority[b.impact])
    .slice(0, 4);
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
  options?: { competitionCount?: number; now?: Date; dataQualityScore?: number },
): Promise<PipelineScoreResult> {
  const rbq = computeVerifiedRbqFit(
    user.rbqLicenseClass,
    user.rbqLicenseNumber,
    user.rbqVerified ?? false,
    permit.permitType,
    permit.workType,
  );
  const permitFit = classifyContractorPermit(permit);
  const hasRbqProfile = Boolean(user.rbqLicenseClass || user.rbqLicenseNumber);
  const rbqFit = hasRbqProfile
    ? user.rbqVerified
      ? rbq.score
      : Math.min(rbq.score, 20)
    : permitFit.score;
  const marketActivityCount =
    options?.competitionCount ??
    (await getCompetitionDensity(permit.permitType, permit.borough));
  const costFit = scoreCostFit(
    permit.estimatedCost,
    user.minProjectCost,
    user.maxProjectCost,
  );
  const marketActivity = scoreMarketActivity(marketActivityCount);
  const freshness = scoreFreshness(permit.issueDate, options?.now);
  const intelligence = scoreIntelligence(intel);
  const zoning = scoreZoning(intel);

  const combined = combineRankingComponents([
    { score: rbqFit, weight: 30, evidenceWeight: 25, missingId: "rbq_profile" },
    {
      score: costFit,
      weight: 20,
      evidenceWeight: 20,
      missingId: "cost_or_budget",
    },
    {
      score: marketActivity,
      weight: 10,
      evidenceWeight: 10,
      missingId: "market_activity",
    },
    {
      score: freshness,
      weight: 15,
      evidenceWeight: 20,
      missingId: "issue_date",
    },
    {
      score: intelligence,
      weight: 15,
      evidenceWeight: 15,
      missingId: "site_intelligence",
    },
    { score: zoning, weight: 10, evidenceWeight: 10, missingId: "zoning" },
  ]);
  const qualityScore = options?.dataQualityScore;
  const adjustedConfidence =
    qualityScore == null
      ? combined.confidence
      : clampScore(combined.confidence * (0.5 + Math.max(0, Math.min(100, qualityScore)) / 200));
  const adjustedCombined = {
    ...combined,
    confidence: adjustedConfidence,
    confidenceLevel: confidenceLevel(adjustedConfidence),
    score: permitFit.contractorWork
      ? clampScore(combined.fitScore * (0.55 + adjustedConfidence * 0.0045))
      : Math.min(
          clampScore(combined.fitScore * (0.55 + adjustedConfidence * 0.0045)),
          38,
        ),
  };
  const densityGapInfo = computeDensityGap(intel);

  return {
    ...adjustedCombined,
    ...(qualityScore == null ? {} : { recordQualityScore: clampScore(qualityScore) }),
    breakdown: {
      rbqFit,
      costFit,
      marketActivity,
      freshness,
      intelligence,
      zoning,
    },
    marketActivityCount,
    reasons: buildReasons({
      rbqFit,
      rbqEligible: rbq.eligible && Boolean(user.rbqVerified),
      costFit,
      freshness,
      marketActivity,
      intelligence,
      densityGap: densityGapInfo.densityGap,
      confidence: adjustedCombined.confidence,
    }),
    ...densityGapInfo,
  };
}
