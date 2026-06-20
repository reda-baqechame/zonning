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
    expect(dossier.nextAction).toContain("Open the municipal source");
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
    expect(dossier.whyRanked.join(" ")).toContain("not high enough");
  });
});
