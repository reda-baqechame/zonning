import type { ZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";
import type { LeadSignal } from "@/lib/lead-signals";

export type CoverageStatus =
  | "authoritative"
  | "partial"
  | "context_only"
  | "document_only"
  | "licensed_required"
  | "unavailable"
  | "stale";

export type SourceRef = {
  id: string;
  title: string;
  url: string;
  publisher?: string;
  license?: string;
  observedAt?: string;
  refreshedAt?: string;
};

export type Evidence<T> = {
  value: T;
  source: SourceRef;
  confidence: number;
  limitations: string[];
  observedAt?: string;
  refreshedAt?: string;
};

export type ZoningRuleVersion = {
  id: string;
  municipality: string;
  zoneCode?: string | null;
  bylawTitle?: string | null;
  bylawUrl?: string | null;
  effectiveDate?: string | null;
  pendingAmendment?: boolean;
  permittedUses: Evidence<string[]>;
  conditionalUses: Evidence<string[]>;
  prohibitedUses: Evidence<string[]>;
  height?: Evidence<string | null>;
  setbacks?: Evidence<string | null>;
  density?: Evidence<string | null>;
  lotCoverage?: Evidence<string | null>;
  parking?: Evidence<string | null>;
  overlays: Evidence<string[]>;
};

export type PermitEventStage =
  | "application"
  | "review"
  | "issuance"
  | "award"
  | "construction";

export type PermitEvent = {
  id: string;
  stage: PermitEventStage;
  title: string;
  municipality?: string | null;
  address?: string | null;
  value?: number | null;
  date?: string | null;
  participants: string[];
  documents: SourceRef[];
  confidence: number;
  source: SourceRef;
};

export type SiteDossier = {
  id: string;
  address: string;
  municipality?: string | null;
  lot?: string | null;
  coverageStatus: CoverageStatus;
  verdict: "insufficient_data" | "eleve" | "moyen" | "faible" | "bloque";
  signals: Evidence<unknown>[];
  zoning?: ZoningRuleVersion;
  zoningAnalysis?: ZoningExpertAnalysis;
  constraints: Evidence<unknown>[];
  permits: PermitEvent[];
  evidenceSummary: {
    parcelSignals: number;
    addressMatchedPermits: number;
    contextualSignals: number;
    decisionConfidence: number;
    canIssueParcelConclusion: boolean;
  };
  limitations: string[];
  generatedAt: string;
};

export type Opportunity = {
  id: string;
  type: "permit" | "tender" | "zoning_change" | "private_project" | "roadwork" | "company";
  title: string;
  municipality?: string | null;
  value?: number | null;
  deadline?: string | null;
  stage?: "pre_planning" | "permit_research" | "bidding" | "award_watch" | "construction_start" | "relationship";
  bidDecision?: "bid" | "review" | "no_bid" | "watch";
  bidDecisionReason?: string;
  actionDueAt?: string | null;
  timingScore: number;
  valueScore: number;
  tradeFitScore: number;
  confidence: number;
  recommendedNextAction: string;
  newSince?: string | null;
  contacts?: {
    role: "owner" | "buyer" | "applicant" | "contractor" | "municipality" | "unknown";
    name: string;
    confidence: number;
  }[];
  documents?: SourceRef[];
  permitChecklist?: {
    label: string;
    status: "ready" | "missing" | "review";
  }[];
  crmReady?: boolean;
  source: SourceRef;
  limitations: string[];
  opportunityDossier?: OpportunityDossier;
};

export type OpportunityDossier = {
  id: string;
  kind: "permit" | "tender" | "roadwork" | "development_project" | "site";
  title: string;
  municipality?: string | null;
  addressOrRegion: string;
  score: number;
  confidence: number;
  confidenceLevel: "low" | "medium" | "high";
  signals: LeadSignal[];
  whyRanked: string[];
  nextAction: string;
  sourceUrl: string;
  sourceLabel: string;
  freshness: {
    label: "today" | "this_week" | "recent" | "stale" | "unknown";
    observedAt?: string | null;
    refreshedAt?: string | null;
  };
  limitations: string[];
  evidenceThresholds: {
    canCallTopLead: boolean;
    canCallHighConfidence: boolean;
    minimumConfidence: number;
    missingEvidence: string[];
  };
  siteIntelligence?: {
    confirmedFacts: string[];
    inferredContext: string[];
    nearbyRisks: string[];
    unavailableEvidence: string[];
  };
  zoningAnalysis?: ZoningExpertAnalysis;
  pipelineBreakdown?: Record<string, number | null>;
  complianceAction?: {
    enabled: boolean;
    label: string;
    reason?: string;
  };
  exportAction?: {
    enabled: boolean;
    fields: string[];
  };
};

export function evidence<T>(
  value: T,
  source: SourceRef,
  confidence: number,
  limitations: string[] = []
): Evidence<T> {
  return {
    value,
    source,
    confidence: Math.max(0, Math.min(1, confidence)),
    limitations,
    observedAt: source.observedAt,
    refreshedAt: source.refreshedAt,
  };
}
