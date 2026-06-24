import { differenceInCalendarDays } from "date-fns";
import {
  combineRankingComponents,
  scoreCostFit,
  type RankingConfidence,
  type RankingReason,
} from "@/lib/pipeline-score";
import { classifyContractorTender } from "@/lib/contractor-fit";

export type TenderScoreInput = {
  title: string;
  description?: string | null;
  category?: string | null;
  region?: string | null;
  organization?: string | null;
  estimatedValue?: number | null;
  closesAt?: Date | null;
  requiresAmp?: boolean;
  sourceUrl?: string | null;
  unspsc?: string | null;
};

export type TenderScoreResult = {
  score: number;
  fitScore: number;
  confidence: number;
  confidenceLevel: RankingConfidence;
  breakdown: {
    tradeFit: number | null;
    regionFit: number | null;
    budgetFit: number | null;
    ampFit: number | null;
    bidWindow: number | null;
  };
  reasons: RankingReason[];
  missingEvidence: string[];
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => {
    const normalized = normalize(needle);
    return normalized.length >= 2 && haystack.includes(normalized);
  });
}

export function scoreBidWindow(
  closesAt: Date | null | undefined,
  now = new Date(),
): number | null {
  if (!closesAt || Number.isNaN(closesAt.getTime())) return null;
  const daysLeft = differenceInCalendarDays(closesAt, now);
  if (daysLeft < 0) return 0;
  if (daysLeft <= 2) return 45;
  if (daysLeft <= 7) return 75;
  if (daysLeft <= 21) return 100;
  if (daysLeft <= 45) return 85;
  return 70;
}

export function computeTenderScore(
  tender: TenderScoreInput,
  user: {
    trades: string[];
    regions: string[];
    ampAuthorized: boolean;
    minProjectCost?: number | null;
    maxProjectCost?: number | null;
  },
  options?: { now?: Date },
): TenderScoreResult {
  const searchable = normalize(
    [tender.title, tender.description, tender.category]
      .filter(Boolean)
      .join(" "),
  );
  const contractorFit = classifyContractorTender(tender);
  const normalizedRegion = normalize(tender.region ?? "");
  const tradeFit = user.trades.length
    ? matchesAny(searchable, user.trades)
      ? 100
      : 20
    : contractorFit.score;
  const regionFit = user.regions.length
    ? matchesAny(normalizedRegion, user.regions)
      ? 100
      : 25
    : null;
  const budgetFit = scoreCostFit(
    tender.estimatedValue,
    user.minProjectCost,
    user.maxProjectCost,
  );
  const ampFit = tender.requiresAmp ? (user.ampAuthorized ? 100 : 0) : null;
  const bidWindow = scoreBidWindow(tender.closesAt, options?.now);

  const combined = combineRankingComponents([
    {
      score: tradeFit,
      weight: 35,
      evidenceWeight: 30,
      missingId: "trade_profile",
    },
    {
      score: regionFit,
      weight: 20,
      evidenceWeight: 20,
      missingId: "region_profile",
    },
    {
      score: budgetFit,
      weight: 15,
      evidenceWeight: 15,
      missingId: "value_or_budget",
    },
    {
      score: ampFit,
      weight: 15,
      evidenceWeight: 10,
      missingId: "amp_requirement",
    },
    {
      score: bidWindow,
      weight: 15,
      evidenceWeight: 20,
      missingId: "closing_date",
    },
  ]);

  let confidence = combined.confidence;
  if (tender.organization) confidence += 2;
  if (tender.sourceUrl?.startsWith("http")) confidence += 1;
  if (tender.unspsc || tender.category) confidence += 2;
  confidence = Math.min(100, confidence);
  const confidenceLevel: RankingConfidence =
    confidence >= 80 ? "high" : confidence >= 55 ? "medium" : "low";
  const uncappedScore = Math.max(
    0,
    Math.min(100, Math.round(combined.fitScore * (0.55 + confidence * 0.0045))),
  );
  const score = contractorFit.contractorWork
    ? uncappedScore
    : Math.min(uncappedScore, 38);

  const reasons: RankingReason[] = [];
  if ((tradeFit ?? 0) >= 90 && contractorFit.contractorWork)
    reasons.push({ id: "trade_match", impact: "positive" });
  else if (tradeFit !== null && tradeFit < 40) {
    reasons.push({ id: "trade_mismatch", impact: "warning" });
  }
  if ((regionFit ?? 0) >= 90)
    reasons.push({ id: "region_match", impact: "positive" });
  if (ampFit === 0) reasons.push({ id: "amp_blocked", impact: "warning" });
  if ((bidWindow ?? 0) >= 85)
    reasons.push({ id: "bid_window", impact: "positive" });
  if (confidence < 55) reasons.push({ id: "limited_evidence", impact: "info" });

  return {
    score,
    fitScore: combined.fitScore,
    confidence,
    confidenceLevel,
    breakdown: { tradeFit, regionFit, budgetFit, ampFit, bidWindow },
    reasons: reasons.slice(0, 4),
    missingEvidence: combined.missingEvidence,
  };
}
