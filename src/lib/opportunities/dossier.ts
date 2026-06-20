import { differenceInCalendarDays } from "date-fns";
import type { OpportunityDossier } from "@/lib/domain/quebec";
import type { LeadSignal } from "@/lib/lead-signals";
import type { PermitDataQuality } from "@/lib/permits/quality";
import type { PipelineScoreResult, RankingReason } from "@/lib/pipeline-score";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { TenderScoreResult } from "@/lib/tender-score";

const TOP_LEAD_MIN_SCORE = 80;
const TOP_LEAD_MIN_CONFIDENCE = 65;
const HIGH_CONFIDENCE_MIN = 75;

type PermitRecord = {
  id: string;
  permitType: string;
  workType?: string | null;
  address: string;
  borough?: string | null;
  city?: string | null;
  estimatedCost?: number | null;
  issueDate?: Date | null;
  applicantName?: string | null;
  sourceUrl: string;
  sourceFetchedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
};

type TenderRecord = {
  id: string;
  title: string;
  organization?: string | null;
  category?: string | null;
  region?: string | null;
  estimatedValue?: number | null;
  publishedAt?: Date | null;
  closesAt?: Date | null;
  requiresAmp?: boolean;
  sourceUrl: string;
  unspsc?: string | null;
  status?: string | null;
  amendmentCount?: number | null;
};

type PermitDossierInput = {
  permit: PermitRecord;
  score: number;
  signals: LeadSignal[];
  pipeline: PipelineScoreResult;
  dataQuality?: PermitDataQuality;
  intelligence?: PropertyIntelligence | null;
};

type TenderDossierInput = {
  tender: TenderRecord;
  score: number;
  signals: LeadSignal[];
  ranking: TenderScoreResult;
  hasSimilarAwards?: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceLevel(confidence: number): OpportunityDossier["confidenceLevel"] {
  if (confidence >= HIGH_CONFIDENCE_MIN) return "high";
  if (confidence >= 55) return "medium";
  return "low";
}

function freshness(date: Date | string | null | undefined, refreshedAt?: Date | string | null): OpportunityDossier["freshness"] {
  const observedAt = date ? new Date(date) : null;
  const days = observedAt && !Number.isNaN(observedAt.getTime())
    ? differenceInCalendarDays(new Date(), observedAt)
    : null;
  return {
    label:
      days == null
        ? "unknown"
        : days <= 1
          ? "today"
          : days <= 7
            ? "this_week"
            : days <= 90
              ? "recent"
              : "stale",
    observedAt: observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt.toISOString() : null,
    refreshedAt: refreshedAt ? new Date(refreshedAt).toISOString() : null,
  };
}

function reasonText(reason: RankingReason): string {
  const copy: Record<RankingReason["id"], string> = {
    verified_rbq_match: "Verified RBQ profile matches the work scope.",
    rbq_mismatch: "RBQ class fit needs review before outreach.",
    cost_in_range: "Declared value fits the configured project range.",
    cost_outside_range: "Declared value is outside the configured project range.",
    fresh_record: "The public record is recent enough for fast action.",
    stale_record: "The public record is older and should be confirmed.",
    active_market: "Similar activity indicates a live local market.",
    site_upside: "Indexed site intelligence suggests possible upside.",
    site_constraints: "Indexed site constraints may affect feasibility.",
    trade_match: "Tender language matches the configured trades.",
    trade_mismatch: "Tender language is weak against the configured trades.",
    region_match: "The region matches the contractor profile.",
    amp_blocked: "AMP authorization may be required before bidding.",
    bid_window: "The bid window is still workable.",
    limited_evidence: "The ranking is limited by missing evidence.",
  };
  return copy[reason.id];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function evidenceThresholds(input: {
  score: number;
  confidence: number;
  missingEvidence: string[];
  hardLimitations: string[];
}) {
  const missing = unique([...input.missingEvidence, ...input.hardLimitations]);
  return {
    canCallTopLead:
      input.score >= TOP_LEAD_MIN_SCORE &&
      input.confidence >= TOP_LEAD_MIN_CONFIDENCE &&
      missing.length <= 3,
    canCallHighConfidence:
      input.confidence >= HIGH_CONFIDENCE_MIN && missing.length <= 2,
    minimumConfidence: TOP_LEAD_MIN_CONFIDENCE,
    missingEvidence: missing,
  };
}

function siteIntelligenceSummary(intelligence?: PropertyIntelligence | null): OpportunityDossier["siteIntelligence"] | undefined {
  if (!intelligence) return undefined;
  const confirmedFacts: string[] = [];
  const inferredContext: string[] = [];
  const nearbyRisks: string[] = [];
  const unavailableEvidence: string[] = [];

  if (intelligence.assessment?.totalValue) confirmedFacts.push("Property assessment value is indexed.");
  else unavailableEvidence.push("No matched property assessment record.");
  if (intelligence.recentTransaction?.salePrice) confirmedFacts.push("Recent transaction evidence is indexed.");
  if (intelligence.zoning?.determination === "confirmed" && intelligence.zoning.evidenceScope === "parcel") {
    confirmedFacts.push("Parcel-level zoning evidence is indexed.");
  } else if (intelligence.zoning) {
    inferredContext.push("Zoning signal is contextual or planning-level only.");
  } else {
    unavailableEvidence.push("No parcel zoning bylaw evidence indexed.");
  }
  if (intelligence.developmentProjects?.nearby) inferredContext.push("Nearby development activity is indexed.");
  if (intelligence.marketHeat) inferredContext.push("Local market heat signal is indexed.");
  if (intelligence.contamination?.gtcNearby || intelligence.contamination?.nearby) nearbyRisks.push("Nearby contaminated-land signal.");
  if (intelligence.heritage?.lpcProtected || intelligence.heritage?.hasEip || intelligence.heritage?.nearby) nearbyRisks.push("Heritage constraint signal.");
  if (intelligence.roadworks?.nearby) nearbyRisks.push("Nearby roadwork signal.");
  if (intelligence.rbqInfraction?.found) nearbyRisks.push("RBQ infraction signal.");
  if (intelligence.municipalInspection?.found) nearbyRisks.push("Municipal inspection signal.");

  return { confirmedFacts, inferredContext, nearbyRisks, unavailableEvidence };
}

export function buildPermitOpportunityDossier(input: PermitDossierInput): OpportunityDossier {
  const { permit, pipeline, dataQuality, intelligence } = input;
  const limitations = unique([
    ...(dataQuality?.issues ?? []).map((issue) => `Permit data quality issue: ${issue}.`),
    ...(pipeline.missingEvidence ?? []).map((item) => `Missing ranking evidence: ${item}.`),
    dataQuality && !dataQuality.officialSource ? "Source host is not recognized as an official Quebec or municipal source." : "",
    dataQuality?.sourceScope === "dataset" ? "Source opens the dataset, not the individual municipal record." : "",
    !permit.applicantName ? "Applicant/contact is not published in this record." : "",
    !permit.estimatedCost ? "Declared work value is not published." : "",
    "Verify the municipal source before outreach, bidding, or compliance action.",
  ]);
  const thresholds = evidenceThresholds({
    score: input.score,
    confidence: pipeline.confidence,
    missingEvidence: pipeline.missingEvidence,
    hardLimitations: dataQuality?.usable === false ? ["permit_record_not_usable"] : [],
  });
  const whyRanked = unique([
    ...pipeline.reasons.map(reasonText),
    input.signals.some((signal) => signal.id === "rbq_eligible") ? "RBQ fit signal is positive." : "",
    input.signals.some((signal) => signal.id === "high_value") ? "Declared value is above the high-value threshold." : "",
    input.signals.some((signal) => signal.id === "density_upside") ? "Site intelligence suggests density upside." : "",
    thresholds.canCallTopLead ? "Evidence threshold passed for top-lead treatment." : "Evidence threshold not high enough for a top-lead claim.",
  ]);

  return {
    id: `permit:${permit.id}`,
    kind: "permit",
    title: permit.permitType,
    municipality: permit.city,
    addressOrRegion: [permit.address, permit.borough].filter(Boolean).join(" - "),
    score: clampScore(input.score),
    confidence: clampScore(pipeline.confidence),
    confidenceLevel: confidenceLevel(pipeline.confidence),
    signals: input.signals,
    whyRanked,
    nextAction: thresholds.canCallTopLead
      ? "Open the municipal source, confirm scope and applicant, then create the compliant follow-up."
      : "Resolve missing evidence before treating this as a qualified lead.",
    sourceUrl: permit.sourceUrl,
    sourceLabel: dataQuality?.sourceScope === "record" ? "Municipal permit record" : "Municipal permit dataset",
    freshness: freshness(permit.issueDate, permit.sourceFetchedAt),
    limitations,
    evidenceThresholds: thresholds,
    siteIntelligence: siteIntelligenceSummary(intelligence),
    pipelineBreakdown: pipeline.breakdown,
    complianceAction: {
      enabled: Boolean(permit.sourceUrl && permit.applicantName && dataQuality?.usable),
      label: "Create CASL public-source certificate",
      reason: permit.applicantName ? undefined : "Applicant/contact is not published.",
    },
    exportAction: {
      enabled: Boolean(dataQuality?.usable),
      fields: ["permitType", "address", "municipality", "score", "confidence", "sourceUrl", "nextAction"],
    },
  };
}

export function buildTenderOpportunityDossier(input: TenderDossierInput): OpportunityDossier {
  const { tender, ranking } = input;
  const limitations = unique([
    ...ranking.missingEvidence.map((item) => `Missing ranking evidence: ${item}.`),
    tender.requiresAmp ? "AMP authorization must be confirmed before bidding." : "",
    tender.amendmentCount ? "One or more addenda/amendments must be reviewed on SEAO." : "",
    !tender.organization ? "Buyer organization is not normalized." : "",
    !tender.closesAt ? "Closing date is not published or not normalized." : "",
    "Official SEAO documents and addenda must be reviewed before a bid/no-bid decision.",
  ]);
  const thresholds = evidenceThresholds({
    score: input.score,
    confidence: ranking.confidence,
    missingEvidence: ranking.missingEvidence,
    hardLimitations: tender.requiresAmp ? ["amp_review_required"] : [],
  });
  const whyRanked = unique([
    ...ranking.reasons.map(reasonText),
    input.hasSimilarAwards ? "Similar SEAO award history is indexed." : "",
    input.signals.some((signal) => signal.id === "urgent_close") ? "Closing date requires near-term action." : "",
    input.signals.some((signal) => signal.id === "thursday_seao") ? "Tender closes on the Thursday SEAO risk window." : "",
    thresholds.canCallTopLead ? "Evidence threshold passed for top-lead treatment." : "Evidence threshold not high enough for a top-lead claim.",
  ]);

  return {
    id: `tender:${tender.id}`,
    kind: "tender",
    title: tender.title,
    municipality: tender.region,
    addressOrRegion: tender.region ?? tender.organization ?? "Quebec",
    score: clampScore(input.score),
    confidence: clampScore(ranking.confidence),
    confidenceLevel: confidenceLevel(ranking.confidence),
    signals: input.signals,
    whyRanked,
    nextAction: thresholds.canCallTopLead
      ? "Review SEAO documents and addenda, assign an estimator, then decide bid/no-bid."
      : "Review missing fit evidence before committing estimating time.",
    sourceUrl: tender.sourceUrl,
    sourceLabel: "SEAO public tender notice",
    freshness: freshness(tender.publishedAt, tender.publishedAt),
    limitations,
    evidenceThresholds: thresholds,
    pipelineBreakdown: ranking.breakdown,
    complianceAction: {
      enabled: false,
      label: "Not a CASL outreach source",
      reason: "Use SEAO procurement workflow, not direct marketing outreach.",
    },
    exportAction: {
      enabled: true,
      fields: ["title", "organization", "region", "score", "confidence", "sourceUrl", "nextAction"],
    },
  };
}
