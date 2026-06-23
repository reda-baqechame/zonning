import type { PropertyIntelligence } from "@/lib/intelligence";
import type { LeadSignal } from "@/lib/lead-signals";
import type { PermitDataQuality } from "@/lib/permits/quality";
import type { PipelineScoreResult } from "@/lib/pipeline-score";
import type { TenderScoreResult } from "@/lib/tender-score";
import type {
  GovernmentReadinessPassport,
  OpportunityDossier,
  PipelineStage,
} from "@/lib/domain/quebec";

export type { GovernmentReadinessPassport };

type SavedOpportunity = {
  id: string;
  score: number;
  signals: LeadSignal[];
  opportunityDossier?: OpportunityDossier;
  saved?: boolean;
  savedNote?: string | null;
  savedStage?: PipelineStage | null;
  savedNextActionAt?: string | null;
};

export type PermitFeedItem = SavedOpportunity & {
  kind: "permit";
  permit: {
    id: string;
    address: string;
    borough?: string | null;
    city?: string | null;
    permitType: string;
    estimatedCost?: number | null;
    issueDate?: string | null;
    pipelineScore?: number;
    summaryFr?: string | null;
    summaryEn?: string | null;
    rbqFit: { eligible: boolean; score: number };
    pipeline?: PipelineScoreResult;
    sourceUrl?: string;
    applicantName?: string | null;
    dataQuality?: PermitDataQuality;
    intelligence?: PropertyIntelligence | null;
    opportunityDossier?: OpportunityDossier;
  };
};

export type TenderFeedItem = SavedOpportunity & {
  kind: "tender";
  tender: {
    id: string;
    title: string;
    organization?: string | null;
    region?: string | null;
    closesAt?: string | null;
    daysLeft?: number | null;
    isThursday?: boolean;
    urgent?: boolean;
    matchScore?: number;
    estimatedValue?: number | null;
    requiresAmp?: boolean;
    plainSummary?: string;
    sourceUrl: string;
    amendmentCount?: number;
    ranking?: TenderScoreResult;
    opportunityDossier?: OpportunityDossier;
  };
};

export type FeedItem = PermitFeedItem | TenderFeedItem;

export function feedItemKey(item: FeedItem): string {
  return `${item.kind}:${item.id}`;
}

export function getFeedDossier(item: FeedItem): OpportunityDossier | undefined {
  return item.opportunityDossier ??
    (item.kind === "permit"
      ? item.permit.opportunityDossier
      : item.tender.opportunityDossier);
}

export function getFeedTitle(item: FeedItem): string {
  return item.kind === "permit"
    ? `${item.permit.permitType} - ${item.permit.address}`
    : item.tender.title;
}

export function getFeedLocation(item: FeedItem): string {
  if (item.kind === "permit") {
    return item.permit.borough ?? item.permit.city ?? item.permit.address;
  }
  return item.tender.region ?? item.tender.organization ?? "Québec";
}

export function getFeedSourceUrl(item: FeedItem): string | undefined {
  return item.kind === "permit" ? item.permit.sourceUrl : item.tender.sourceUrl;
}
