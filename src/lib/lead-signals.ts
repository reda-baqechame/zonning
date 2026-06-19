import { differenceInDays, getDay } from "date-fns";
import type { PipelineScoreResult } from "@/lib/pipeline-score";
import type { PropertyIntelligence } from "@/lib/intelligence";

export type LeadSignalId =
  | "strong_match"
  | "rbq_eligible"
  | "high_value"
  | "urgent_close"
  | "thursday_seao"
  | "amp_required"
  | "gtc_risk"
  | "heritage_risk"
  | "density_upside"
  | "new_this_week"
  | "award_linked"
  | "rbq_infraction"
  | "inspection_flag";

export type LeadSignal = {
  id: LeadSignalId;
  severity: "positive" | "warning" | "info";
};

export type LeadUserContext = {
  minProjectCost?: number | null;
  maxProjectCost?: number | null;
  rbqVerified?: boolean;
  ampAuthorized?: boolean;
};

export type PermitLeadInput = {
  kind: "permit";
  id: string;
  score: number;
  permitType: string;
  address: string;
  borough?: string | null;
  city?: string | null;
  estimatedCost?: number | null;
  issueDate?: Date | string | null;
  rbqFit?: { eligible: boolean; score: number };
  pipeline?: PipelineScoreResult;
  intelligence?: PropertyIntelligence;
  sourceUrl?: string;
  applicantName?: string | null;
  summaryFr?: string | null;
  summaryEn?: string | null;
};

export type TenderLeadInput = {
  kind: "tender";
  id: string;
  score: number;
  title: string;
  organization?: string | null;
  closesAt?: Date | string | null;
  daysLeft?: number | null;
  isThursday?: boolean;
  urgent?: boolean;
  requiresAmp?: boolean;
  matchScore?: number;
  plainSummary?: string;
  sourceUrl: string;
  hasSimilarAwards?: boolean;
  amendmentCount?: number;
};

export type LeadInput = PermitLeadInput | TenderLeadInput;

const HIGH_VALUE_DEFAULT = 500_000;

export function computeLeadSignals(
  item: LeadInput,
  user: LeadUserContext = {}
): LeadSignal[] {
  const signals: LeadSignal[] = [];

  if (item.score >= 80) {
    signals.push({ id: "strong_match", severity: "positive" });
  }

  if (item.kind === "permit") {
    if (item.rbqFit?.eligible && user.rbqVerified !== false) {
      signals.push({ id: "rbq_eligible", severity: "positive" });
    }
    const minCost = user.minProjectCost ?? HIGH_VALUE_DEFAULT;
    if ((item.estimatedCost ?? 0) >= minCost) {
      signals.push({ id: "high_value", severity: "positive" });
    }
    if (item.issueDate) {
      const days = differenceInDays(new Date(), new Date(item.issueDate));
      if (days <= 7) signals.push({ id: "new_this_week", severity: "info" });
    }
    if (item.intelligence?.contamination?.gtcNearby) {
      signals.push({ id: "gtc_risk", severity: "warning" });
    }
    const h = item.intelligence?.heritage;
    if (h?.lpcProtected || h?.pum2050Listed || h?.hasEip) {
      signals.push({ id: "heritage_risk", severity: "warning" });
    }
    if (item.pipeline?.densityGap === "upside") {
      signals.push({ id: "density_upside", severity: "positive" });
    }
    if (item.intelligence?.rbqInfraction?.found) {
      signals.push({ id: "rbq_infraction", severity: "warning" });
    }
    if (item.intelligence?.municipalInspection?.found) {
      signals.push({ id: "inspection_flag", severity: "warning" });
    }
  }

  if (item.kind === "tender") {
    const daysLeft =
      item.daysLeft ??
      (item.closesAt ? differenceInDays(new Date(item.closesAt), new Date()) : null);
    if (daysLeft !== null && daysLeft <= 7) {
      signals.push({ id: "urgent_close", severity: "warning" });
    }
    const isThu =
      item.isThursday ??
      (item.closesAt ? getDay(new Date(item.closesAt)) === 4 : false);
    if (isThu) signals.push({ id: "thursday_seao", severity: "warning" });
    if (item.requiresAmp) signals.push({ id: "amp_required", severity: "info" });
    if (item.hasSimilarAwards) signals.push({ id: "award_linked", severity: "info" });
  }

  return signals;
}

export function filterItemsBySignal<T extends { signals: LeadSignal[] }>(
  items: T[],
  filter: "urgent" | "rbq" | "high_value" | "risks" | null
): T[] {
  if (!filter) return items;
  return items.filter((item) => {
    const ids = new Set(item.signals.map((s) => s.id));
    switch (filter) {
      case "urgent":
        return ids.has("urgent_close") || ids.has("thursday_seao");
      case "rbq":
        return ids.has("rbq_eligible");
      case "high_value":
        return ids.has("high_value") || ids.has("strong_match");
      case "risks":
        return (
          ids.has("gtc_risk") ||
          ids.has("heritage_risk") ||
          ids.has("amp_required") ||
          ids.has("rbq_infraction") ||
          ids.has("inspection_flag")
        );
      default:
        return true;
    }
  });
}

export function signalLabelKey(id: LeadSignalId): string {
  return `leadSignals.${id}`;
}
