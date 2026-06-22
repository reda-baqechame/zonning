import { describe, expect, it } from "vitest";
import { computeTenderScore } from "./tender-score";

const now = new Date("2026-06-20T12:00:00Z");
const user = {
  trades: ["électricité"],
  regions: ["Montréal"],
  ampAuthorized: true,
  minProjectCost: 50_000,
  maxProjectCost: 1_000_000,
};

describe("computeTenderScore", () => {
  it("rewards trade, region, budget, AMP, and a workable bid window", () => {
    const result = computeTenderScore(
      {
        title: "Travaux d'électricité municipaux",
        category: "Construction",
        region: "Montréal",
        organization: "Ville test",
        estimatedValue: 300_000,
        closesAt: new Date("2026-07-01T12:00:00Z"),
        requiresAmp: true,
        sourceUrl: "https://seao.ca/example",
      },
      user,
      { now },
    );

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.confidenceLevel).toBe("high");
    expect(result.reasons.map((reason) => reason.id)).toContain("trade_match");
    expect(result.reasons.map((reason) => reason.id)).toContain("region_match");
  });

  it("does not promote an AMP-blocked mismatch", () => {
    const result = computeTenderScore(
      {
        title: "Travaux de plomberie",
        region: "Outaouais",
        estimatedValue: 300_000,
        closesAt: new Date("2026-06-21T12:00:00Z"),
        requiresAmp: true,
      },
      { ...user, ampAuthorized: false },
      { now },
    );

    expect(result.score).toBeLessThan(50);
    expect(result.reasons.map((reason) => reason.id)).toContain("amp_blocked");
    expect(result.reasons.map((reason) => reason.id)).toContain(
      "trade_mismatch",
    );
  });

  it("marks an unprofiled tender as low confidence", () => {
    const result = computeTenderScore(
      { title: "Travaux divers", closesAt: new Date("2026-07-01T12:00:00Z") },
      { trades: [], regions: [], ampAuthorized: false },
      { now },
    );

    expect(result.confidenceLevel).toBe("low");
    expect(result.reasons.map((reason) => reason.id)).toContain(
      "limited_evidence",
    );
  });
});
