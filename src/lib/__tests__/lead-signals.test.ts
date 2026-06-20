import { describe, expect, it } from "vitest";
import { computeLeadSignals, filterItemsBySignal } from "@/lib/lead-signals";
import { matchesEssentielProfile } from "@/lib/usage";

describe("computeLeadSignals", () => {
  it("flags strong match at score >= 80", () => {
    const signals = computeLeadSignals({
      kind: "permit",
      id: "1",
      score: 85,
      permitType: "Construction",
      address: "123 rue Test",
      rbqFit: { eligible: true, score: 90 },
      pipeline: {
        score: 85,
        fitScore: 90,
        confidence: 80,
        confidenceLevel: "high",
        breakdown: {
          rbqFit: 90,
          costFit: 90,
          marketActivity: 80,
          freshness: 90,
          intelligence: null,
          zoning: null,
        },
        marketActivityCount: 8,
        reasons: [],
        missingEvidence: ["site_intelligence", "zoning"],
      },
    });
    expect(signals.some((s) => s.id === "strong_match")).toBe(true);
  });

  it("flags urgent tender within 7 days", () => {
    const signals = computeLeadSignals({
      kind: "tender",
      id: "t1",
      score: 70,
      title: "Toiture",
      daysLeft: 3,
      urgent: true,
      sourceUrl: "https://seao.ca",
    });
    expect(signals.some((s) => s.id === "urgent_close")).toBe(true);
  });

  it("does not call a low-confidence score a strong match", () => {
    const signals = computeLeadSignals({
      kind: "permit",
      id: "uncertain",
      score: 90,
      permitType: "Construction",
      address: "123 rue Test",
      pipeline: {
        score: 90,
        fitScore: 98,
        confidence: 30,
        confidenceLevel: "low",
        breakdown: {
          rbqFit: null,
          costFit: null,
          marketActivity: 90,
          freshness: 100,
          intelligence: null,
          zoning: null,
        },
        marketActivityCount: 20,
        reasons: [{ id: "limited_evidence", impact: "info" }],
        missingEvidence: [
          "rbq_profile",
          "cost_or_budget",
          "site_intelligence",
          "zoning",
        ],
      },
    });

    expect(signals.some((signal) => signal.id === "strong_match")).toBe(false);
  });

  it("flags GTC risk on permits", () => {
    const signals = computeLeadSignals({
      kind: "permit",
      id: "2",
      score: 60,
      permitType: "Excavation",
      address: "456 rue Test",
      intelligence: {
        contamination: { nearby: true, count: 1, gtcNearby: true, gtcCount: 1 },
      },
    });
    expect(signals.some((s) => s.id === "gtc_risk")).toBe(true);
  });
});

describe("filterItemsBySignal", () => {
  const items = [
    {
      id: "a",
      signals: [{ id: "urgent_close" as const, severity: "warning" as const }],
    },
    {
      id: "b",
      signals: [{ id: "rbq_eligible" as const, severity: "positive" as const }],
    },
  ];

  it("filters urgent items", () => {
    const filtered = filterItemsBySignal(items, "urgent");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("a");
  });
});

describe("matchesEssentielProfile", () => {
  it("matches any trade when multiple configured", () => {
    const ok = matchesEssentielProfile(
      "ESSENTIEL",
      ["plomberie", "toiture"],
      ["Laval"],
      {
        title: "Réfection toiture commerciale",
        region: "Laval",
      },
    );
    expect(ok).toBe(true);
  });

  it("rejects when no trade matches", () => {
    const ok = matchesEssentielProfile("ESSENTIEL", ["plomberie"], ["Laval"], {
      title: "Électricité résidentielle",
      region: "Laval",
    });
    expect(ok).toBe(false);
  });

  it("passes through for PRO plan", () => {
    expect(
      matchesEssentielProfile("PRO", ["plomberie"], ["Laval"], {
        title: "anything",
      }),
    ).toBe(true);
  });
});
