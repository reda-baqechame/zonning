import type { ZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";
import type { LeadSignal } from "@/lib/lead-signals";
import type { ValueEstimate } from "@/lib/permits/value-estimate";
import type { ContactLeads } from "@/lib/opportunities/contact-resolver";
import type { ParcelVerdict } from "@/lib/compliance/parcel-verdict";
import type { ContractorCompliance } from "@/lib/compliance/contractor-compliance";
import type { OpportunityDecision } from "@/lib/opportunities/opportunity-decision";

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
  triage: {
    recommendation: "act_now" | "verify_first" | "watch" | "deprioritize";
    reason: string;
    effort: "light" | "moderate" | "heavy";
    actionBy?: string | null;
    blockers: string[];
    recommendedStage: "new" | "researching" | "pursuing";
  };
  governmentMission?: {
    verdict: "pursue" | "verify_before_spend" | "watch" | "skip";
    worthBuyingDocuments: boolean;
    deadlineRisk: "none" | "unknown" | "soon" | "urgent" | "missed";
    deadlineLabel: string;
    officialSiteAction: string;
    requiredDocuments: string[];
    missingReadiness: string[];
    rejectionRisks: string[];
    taskBoard: {
      id: string;
      title: string;
      detail: string;
      status: "ready" | "todo" | "blocked" | "verify";
      deadlineLabel?: string;
      buttonLabel: string;
      href?: string;
    }[];
    nextButtons: {
      label: string;
      href?: string;
      kind: "official_source" | "pipeline" | "document_check" | "readiness";
    }[];
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
  valueEstimate?: ValueEstimate;
  contactLeads?: ContactLeads;
  parcelVerdict?: ParcelVerdict;
  compliance?: ContractorCompliance;
  decision?: OpportunityDecision;
};

export type GovernmentReadinessPassport = {
  score: number;
  status: "ready" | "partial" | "blocked";
  headline: string;
  readyItems: string[];
  missingItems: string[];
  blockers: string[];
  nextActions: {
    id: string;
    label: string;
    detail: string;
    buttonLabel: string;
    href: string;
    priority: "high" | "medium" | "low";
  }[];
  officialSites: {
    id: string;
    label: string;
    purpose: string;
    accountRequired: string;
    href: string;
  }[];
  /**
   * The default mission board for "get ready to bid on Quebec government work",
   * ordered the way a contractor must complete it: identity -> licences ->
   * attestations -> thresholds -> obligations -> submission. Each task links to
   * the action or official site that resolves it.
   */
  missionBoard: {
    id: string;
    step: number;
    title: string;
    detail: string;
    status: "ready" | "todo" | "blocked" | "verify";
    buttonLabel: string;
    href?: string;
  }[];
};

export type PipelineStage =
  | "new"
  | "researching"
  | "pursuing"
  | "submitted"
  | "won"
  | "lost"
  | "archived";

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
