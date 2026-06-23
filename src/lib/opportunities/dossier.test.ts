import { describe, expect, it } from "vitest";
import {
  buildPermitOpportunityDossier,
  buildTenderOpportunityDossier,
} from "@/lib/opportunities/dossier";
import type { PipelineScoreResult } from "@/lib/pipeline-score";
import type { TenderScoreResult } from "@/lib/tender-score";

const strongPipeline: PipelineScoreResult = {
  score: 86,
  fitScore: 90,
  confidence: 82,
  confidenceLevel: "high",
  breakdown: {
    rbqFit: 95,
    costFit: 90,
    marketActivity: 80,
    freshness: 95,
    intelligence: 70,
    zoning: 65,
  },
  marketActivityCount: 8,
  reasons: [
    { id: "verified_rbq_match", impact: "positive" },
    { id: "fresh_record", impact: "positive" },
  ],
  missingEvidence: [],
};

const weakTenderRanking: TenderScoreResult = {
  score: 91,
  fitScore: 98,
  confidence: 40,
  confidenceLevel: "low",
  breakdown: {
    tradeFit: null,
    regionFit: null,
    budgetFit: null,
    ampFit: null,
    bidWindow: 100,
  },
  reasons: [{ id: "limited_evidence", impact: "info" }],
  missingEvidence: ["trade_profile", "region_profile", "value_or_budget"],
};

const strongTenderRanking: TenderScoreResult = {
  score: 88,
  fitScore: 91,
  confidence: 78,
  confidenceLevel: "high",
  breakdown: {
    tradeFit: 95,
    regionFit: 85,
    budgetFit: 80,
    ampFit: 100,
    bidWindow: 75,
  },
  reasons: [
    { id: "trade_match", impact: "positive" },
    { id: "region_match", impact: "positive" },
    { id: "bid_window", impact: "positive" },
  ],
  missingEvidence: [],
};

describe("OpportunityDossier", () => {
  it("allows top-lead treatment only when score and evidence both pass", () => {
    const dossier = buildPermitOpportunityDossier({
      permit: {
        id: "permit-1",
        permitType: "Renovation",
        workType: "Interior",
        address: "100 rue Test",
        borough: "Ville-Marie",
        city: "Montreal",
        estimatedCost: 750_000,
        issueDate: new Date(),
        applicantName: "Client Test",
        sourceUrl: "https://donneesquebec.ca/recherche/dataset/test",
        sourceFetchedAt: new Date(),
        latitude: 45.5,
        longitude: -73.6,
      },
      score: 86,
      signals: [{ id: "strong_match", severity: "positive" }],
      pipeline: strongPipeline,
      dataQuality: {
        score: 90,
        grade: "high",
        usable: true,
        officialSource: true,
        sourceScope: "record",
        issues: [],
      },
    });

    expect(dossier.evidenceThresholds.canCallTopLead).toBe(true);
    expect(dossier.confidenceLevel).toBe("high");
    expect(dossier.triage.recommendation).toBe("act_now");
    expect(dossier.triage.recommendedStage).toBe("pursuing");
    expect(dossier.nextAction).toContain("Open the municipal source");
    expect(dossier.governmentMission?.verdict).toBe("pursue");
    expect(dossier.governmentMission?.worthBuyingDocuments).toBe(false);
    expect(dossier.governmentMission?.officialSiteAction).toContain(
      "Open the municipal source",
    );
    expect(dossier.governmentMission?.requiredDocuments.join(" ")).toContain(
      "RBQ licence",
    );
    expect(dossier.governmentMission?.taskBoard.map((task) => task.id)).toEqual([
      "open-municipal-source",
      "verify-rbq-class",
      "check-zoning",
      "casl-proof",
    ]);
  });

  it("blocks top-lead language when confidence is low even if score is high", () => {
    const dossier = buildTenderOpportunityDossier({
      tender: {
        id: "tender-1",
        title: "Construction work",
        organization: null,
        category: "Construction",
        region: null,
        estimatedValue: null,
        publishedAt: null,
        closesAt: new Date(Date.now() + 5 * 86_400_000),
        requiresAmp: false,
        sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/systeme-electronique-dappel-doffres-seao",
        unspsc: null,
        status: null,
      },
      score: 91,
      signals: [{ id: "urgent_close", severity: "warning" }],
      ranking: weakTenderRanking,
    });

    expect(dossier.evidenceThresholds.canCallTopLead).toBe(false);
    expect(dossier.confidenceLevel).toBe("low");
    expect(dossier.triage.recommendation).not.toBe("act_now");
    expect(dossier.triage.blockers).toEqual([
      "trade_profile",
      "region_profile",
      "value_or_budget",
    ]);
    expect(dossier.limitations.join(" ")).toContain(
      "target trades must be configured",
    );
    expect(dossier.limitations.join(" ")).not.toContain("trade_profile");
    expect(dossier.limitations.join(" ")).not.toContain("value_or_budget");
    expect(dossier.whyRanked.join(" ")).toContain("not high enough");
    expect(dossier.governmentMission?.verdict).toBe("watch");
    expect(dossier.governmentMission?.worthBuyingDocuments).toBe(false);
    expect(dossier.governmentMission?.missingReadiness.join(" ")).toContain(
      "Trades your company",
    );
    expect(dossier.governmentMission?.missingReadiness.join(" ")).not.toContain(
      "trade_profile",
    );
  });

  it("turns a qualified SEAO record into a document-buying mission", () => {
    const dossier = buildTenderOpportunityDossier({
      tender: {
        id: "tender-strong",
        title: "Library envelope rehabilitation",
        organization: "Ville Test",
        category: "Construction",
        region: "Montreal",
        estimatedValue: 1_200_000,
        publishedAt: new Date(),
        closesAt: new Date(Date.now() + 14 * 86_400_000),
        requiresAmp: false,
        sourceUrl: "https://seao.ca/OpportunityPublication/avis",
        unspsc: null,
        status: "open",
        amendmentCount: 1,
      },
      score: 88,
      signals: [{ id: "strong_match", severity: "positive" }],
      ranking: strongTenderRanking,
      hasSimilarAwards: true,
    });

    expect(dossier.triage.recommendation).toBe("act_now");
    expect(dossier.governmentMission?.verdict).toBe("pursue");
    expect(dossier.governmentMission?.worthBuyingDocuments).toBe(true);
    expect(dossier.governmentMission?.deadlineRisk).toBe("none");
    expect(dossier.governmentMission?.officialSiteAction).toContain("Open SEAO");
    expect(dossier.governmentMission?.requiredDocuments.join(" ")).toContain(
      "Revenu",
    );
    expect(dossier.governmentMission?.requiredDocuments.join(" ")).toContain(
      "addenda",
    );
    expect(dossier.governmentMission?.nextButtons.some((button) => button.kind === "official_source")).toBe(true);
    expect(dossier.governmentMission?.taskBoard.map((task) => task.id)).toEqual([
      "open-seao",
      "deadline-addenda",
      "amp-threshold",
      "revenue-quebec",
      "lobbyism-declaration",
      "price-submit",
    ]);
  });

  it("blocks SEAO document spend when AMP and readiness gaps are unresolved", () => {
    const dossier = buildTenderOpportunityDossier({
      tender: {
        id: "tender-amp",
        title: "Public building expansion",
        organization: "Public buyer",
        category: "Construction",
        region: "Quebec",
        estimatedValue: 5_000_000,
        publishedAt: new Date(),
        closesAt: new Date(Date.now() + 5 * 86_400_000),
        requiresAmp: true,
        sourceUrl: "https://seao.ca/OpportunityPublication/avis-amp",
        unspsc: null,
        status: "open",
      },
      score: 74,
      signals: [{ id: "amp_required", severity: "warning" }],
      ranking: { ...weakTenderRanking, confidence: 45 },
    });

    const mission = dossier.governmentMission;
    expect(mission?.verdict).toBe("verify_before_spend");
    expect(mission?.worthBuyingDocuments).toBe(false);
    expect(mission?.deadlineRisk).toBe("soon");
    expect(mission?.requiredDocuments.join(" ")).toContain("AMP authorization");
    expect(mission?.missingReadiness.join(" ")).toContain("AMP confirmation");
    expect(mission?.rejectionRisks.join(" ")).toContain("AMP authorization");
    expect(mission?.missingReadiness.join(" ")).not.toContain("amp_review_required");
    expect(mission?.taskBoard.find((task) => task.id === "amp-threshold")?.status).toBe("blocked");
  });

  it("keeps permit quality codes out of contractor-facing limitations", () => {
    const dossier = buildPermitOpportunityDossier({
      permit: {
        id: "permit-partial",
        permitType: "Renovation",
        address: "200 rue Test",
        city: "Montreal",
        sourceUrl: "https://donnees.montreal.ca/dataset/permis",
      },
      score: 55,
      signals: [],
      pipeline: {
        ...strongPipeline,
        confidence: 45,
        missingEvidence: ["cost_or_budget", "zoning"],
      },
      dataQuality: {
        score: 55,
        grade: "medium",
        usable: true,
        officialSource: true,
        sourceScope: "dataset",
        issues: ["dataset_level_source", "missing_cost"],
      },
    });

    const limitations = dossier.limitations.join(" ");
    expect(limitations).toContain("municipal dataset");
    expect(limitations).toContain("parcel zone");
    expect(limitations).not.toContain("dataset_level_source");
    expect(limitations).not.toContain("cost_or_budget");
  });

  it("localizes contractor actions without changing the evidence gate", () => {
    const dossier = buildPermitOpportunityDossier({
      locale: "fr",
      permit: {
        id: "permit-fr",
        permitType: "Rénovation",
        address: "100 rue Test",
        city: "Montréal",
        estimatedCost: 750_000,
        issueDate: new Date(),
        applicantName: "Client Test",
        sourceUrl: "https://donneesquebec.ca/recherche/dataset/test",
        sourceFetchedAt: new Date(),
      },
      score: 86,
      signals: [],
      pipeline: strongPipeline,
      dataQuality: {
        score: 90,
        grade: "high",
        usable: true,
        officialSource: true,
        sourceScope: "record",
        issues: [],
      },
    });

    expect(dossier.evidenceThresholds.canCallTopLead).toBe(true);
    expect(dossier.nextAction).toContain("Ouvrir la source municipale");
    expect(dossier.sourceLabel).toBe("Dossier municipal de permis");
  });
});
