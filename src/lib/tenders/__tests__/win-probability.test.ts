import { describe, it, expect } from "vitest";
import {
  computeWinProbability,
  buildMatchReasons,
  computeBidRecommendation,
} from "@/lib/tenders/win-probability";
import { aggregateIncumbents } from "@/lib/tenders/incumbent";

const base = {
  matchScore: 50,
  ampRequired: false,
  ampAuthorized: false,
  estimatedValue: 500_000 as number | null,
  userMinCost: 50_000 as number | null,
  userMaxCost: 3_000_000 as number | null,
  distinctWinners: 4,
  incumbentDominance: 0.3,
};

describe("computeWinProbability", () => {
  it("returns a probability in [2, 95] and a proportional expected value", () => {
    const r = computeWinProbability(base);
    expect(r.winProbability).toBeGreaterThanOrEqual(2);
    expect(r.winProbability).toBeLessThanOrEqual(95);
    expect(r.expectedValue).toBe(Math.round(500_000 * (r.winProbability / 100)));
  });

  it("collapses odds when AMP is required but the user is not authorized", () => {
    const without = computeWinProbability({ ...base, ampRequired: true, ampAuthorized: false });
    const withAmp = computeWinProbability({ ...base, ampRequired: true, ampAuthorized: true });
    expect(without.winProbability).toBeLessThan(withAmp.winProbability);
  });

  it("rewards strong fit and low competition", () => {
    const weak = computeWinProbability({ ...base, matchScore: 20, distinctWinners: 15 });
    const strong = computeWinProbability({ ...base, matchScore: 95, distinctWinners: 2 });
    expect(strong.winProbability).toBeGreaterThan(weak.winProbability);
  });

  it("favors the user when they are the incumbent", () => {
    const outsider = computeWinProbability({ ...base, incumbentDominance: 0.8 });
    const incumbent = computeWinProbability({ ...base, isUserIncumbent: true });
    expect(incumbent.winProbability).toBeGreaterThan(outsider.winProbability);
  });

  it("reports null expected value when contract size is unknown", () => {
    expect(computeWinProbability({ ...base, estimatedValue: null }).expectedValue).toBeNull();
  });
});

describe("computeBidRecommendation", () => {
  it("is no-bid when AMP gate is unmet", () => {
    const win = computeWinProbability({ ...base, ampRequired: true, ampAuthorized: false });
    const rec = computeBidRecommendation(win, { matchScore: 80, ampRequired: true, ampAuthorized: false });
    expect(rec.decision).toBe("no-bid");
  });

  it("recommends bidding on strong, winnable tenders", () => {
    const win = computeWinProbability({ ...base, matchScore: 95, distinctWinners: 2, isUserIncumbent: true });
    const rec = computeBidRecommendation(win, { matchScore: 95, ampRequired: false, ampAuthorized: true });
    expect(["bid", "consider"]).toContain(rec.decision);
  });
});

describe("buildMatchReasons", () => {
  it("produces bilingual, signed reasons", () => {
    const reasons = buildMatchReasons({
      matchedTrades: ["électrique"],
      matchedRegion: "Montréal",
      ampRequired: true,
      ampAuthorized: false,
      valueFit: "in_range",
      distinctWinners: 2,
    });
    expect(reasons.length).toBeGreaterThan(0);
    for (const r of reasons) {
      expect(r.fr).toBeTruthy();
      expect(r.en).toBeTruthy();
      expect(typeof r.positive).toBe("boolean");
    }
    // AMP gap should be flagged as a negative.
    expect(reasons.some((r) => !r.positive)).toBe(true);
  });
});

describe("aggregateIncumbents", () => {
  it("ranks winners and computes dominance + overrun", () => {
    const agg = aggregateIncumbents([
      { winnerName: "A", awardAmount: 100, finalValue: 120 },
      { winnerName: "A", awardAmount: 200, finalValue: 200 },
      { winnerName: "B", awardAmount: 100, finalValue: 100 },
      { winnerName: null, awardAmount: 50, finalValue: 50 },
    ]);
    expect(agg.totalAwards).toBe(3);
    expect(agg.distinctWinners).toBe(2);
    expect(agg.topIncumbents[0].name).toBe("A");
    expect(agg.topIncumbents[0].wins).toBe(2);
    expect(agg.dominance).toBeCloseTo(2 / 3, 5);
    // A overran 20% then 0% → avg 10%.
    expect(agg.topIncumbents[0].avgOverrunPct).toBe(10);
  });

  it("returns an empty shape for no awards", () => {
    const agg = aggregateIncumbents([]);
    expect(agg.totalAwards).toBe(0);
    expect(agg.topIncumbents).toEqual([]);
  });
});
