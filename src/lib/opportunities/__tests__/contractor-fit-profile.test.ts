import { describe, expect, it } from "vitest";
import { scoreOpportunityForUser } from "@/lib/opportunities/contractor-fit-profile";

const profile = {
  rbqLicenseClass: "1.1.1",
  trades: ["construction", "résidentiel"],
  regions: ["Montréal"],
  minProjectCost: 50_000,
  maxProjectCost: 500_000,
};

const matchingValue = {
  kind: "estimated" as const,
  low: 120_000,
  high: 400_000,
  currency: "CAD" as const,
  confidence: "high" as const,
  basis: [],
};

describe("scoreOpportunityForUser", () => {
  it("scores high when RBQ class, region, and value band all match", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["1.1.1"],
        city: "Montréal",
        permitType: "Construction résidentielle",
        valueEstimate: matchingValue,
      },
      profile,
    );
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(s.breakdown.some((b) => b.id === "rbq_class_match")).toBe(true);
    expect(s.breakdown.some((b) => b.id === "region_match")).toBe(true);
    expect(s.breakdown.some((b) => b.id === "value_in_budget")).toBe(true);
  });

  it("scores weak when RBQ class does not match (eligibility gate)", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["4.1"],
        city: "Montréal",
        permitType: "Électrique",
        valueEstimate: {
          kind: "estimated",
          low: 10_000,
          high: 60_000,
          currency: "CAD",
          confidence: "medium",
          basis: [],
        },
      },
      profile,
    );
    // RBQ mismatch is a near-disqualifier regardless of region/budget overlap.
    expect(s.level).toBe("weak");
    expect(s.breakdown.some((b) => b.id === "rbq_class_mismatch")).toBe(true);
    expect(s.score).toBeLessThanOrEqual(45);
  });

  it("returns a public anonymized score when profile is null", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["1.1.1"],
        city: "Montréal",
        permitType: "Construction résidentielle",
        valueEstimate: matchingValue,
      },
      null,
    );
    expect(s.breakdown.some((b) => b.id === "anonymous")).toBe(true);
  });

  it("penalizes when value band is outside budget", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["1.1.1"],
        city: "Montréal",
        permitType: "Construction résidentielle",
        valueEstimate: {
          kind: "estimated",
          low: 1_500_000,
          high: 5_000_000,
          currency: "CAD",
          confidence: "high",
          basis: [],
        },
      },
      profile,
    );
    expect(s.breakdown.some((b) => b.id === "value_outside_budget")).toBe(true);
  });
});
