import { describe, expect, it } from "vitest";
import {
  buildOpportunityDecision,
  buildPersonalBlockers,
} from "@/lib/opportunities/opportunity-decision";
import type { ReadinessProfile } from "@/lib/readiness-passport";

const emptyProfile: ReadinessProfile = {
  trades: [],
  regions: [],
  ampAuthorized: false,
  lobbyismDeclarationOnFile: false,
  signingResolutionOnFile: false,
  referencesCount: 0,
  employeesCount: 0,
};

const baseMission = {
  verdict: "pursue" as const,
  worthBuyingDocuments: true,
  deadlineRisk: "soon" as const,
  deadlineLabel: "Closes in 14 days.",
  officialSiteAction: "Open SEAO",
  requiredDocuments: [],
  missingReadiness: [],
  rejectionRisks: [],
  taskBoard: [
    {
      id: "open-seao",
      title: "Open SEAO",
      detail: "Confirm buyer.",
      status: "todo" as const,
      buttonLabel: "Open SEAO",
      href: "https://seao.ca/example",
    },
  ],
  nextButtons: [
    { kind: "official_source" as const, label: "Open SEAO", href: "https://seao.ca/example" },
  ],
};

describe("buildPersonalBlockers", () => {
  it("flags AMP when required and not declared", () => {
    const blockers = buildPersonalBlockers({
      profile: emptyProfile,
      tender: { requiresAmp: true, sourceUrl: "https://seao.ca/x" },
      locale: "en",
    });
    expect(blockers.some((b) => b.id === "amp" && b.severity === "blocker")).toBe(true);
  });

  it("flags RENA non-admissible as hard blocker", () => {
    const blockers = buildPersonalBlockers({
      profile: emptyProfile,
      tender: { sourceUrl: "https://seao.ca/x" },
      compliance: {
        neq: "123",
        legalName: "Test Co",
        legalStatus: "active",
        rbqLicense: null,
        renaNonAdmissible: { active: true },
        sanctions: { count: 0, recent: [] },
        convictions: { count: 0, recent: [] },
        injuryClaims: null,
        awardsWon: { count: 0, totalValue: 0, recent: [] },
        publicBidEligible: false,
        overallRisk: "high",
      },
      locale: "en",
    });
    expect(blockers.some((b) => b.id === "rena")).toBe(true);
  });
});

describe("buildOpportunityDecision", () => {
  it("downgrades pursue to verify_before_spend when AMP blocker exists", () => {
    const decision = buildOpportunityDecision({
      mission: baseMission,
      profile: emptyProfile,
      tender: { requiresAmp: true, sourceUrl: "https://seao.ca/x", estimatedValue: 2_000_000 },
      ranking: { score: 72 },
      locale: "en",
    });
    expect(decision.worthPursuing).toBe("verify_before_spend");
    expect(decision.buyDocuments).toBe(false);
    expect(decision.blockerCount).toBeGreaterThan(0);
  });

  it("allows buy documents when profile is ready", () => {
    const ready: ReadinessProfile = {
      ...emptyProfile,
      ampAuthorized: true,
      rbqLicenseNumber: "1234",
      rbqLicenseClass: "1.2",
      revenuQuebecStatus: "valid",
      revenuQuebecExpiresAt: new Date(Date.now() + 86400000 * 90),
      lobbyismDeclarationOnFile: true,
    };
    const decision = buildOpportunityDecision({
      mission: baseMission,
      profile: ready,
      tender: { requiresAmp: true, sourceUrl: "https://seao.ca/x", estimatedValue: 500_000 },
      ranking: { score: 80 },
      awardStats: { distinctWinners: 3, incumbentDominance: 0.2 },
      locale: "en",
    });
    expect(decision.worthPursuing).toBe("pursue");
    expect(decision.buyDocuments).toBe(true);
    expect(decision.winProbability).toBeGreaterThan(0);
  });
});
