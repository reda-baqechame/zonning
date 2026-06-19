import { describe, it, expect, beforeEach } from "vitest";
import { hasIntelligenceData, type PropertyIntelligence } from "@/lib/intelligence";
import { dataWarn, getDataWarnCount, resetDataWarnCount } from "@/lib/datasets/log";
import { Rng, hashSeed } from "../../../prisma/seed-data/rng";

describe("hasIntelligenceData", () => {
  it("returns false for an empty/placeholder payload", () => {
    expect(hasIntelligenceData({ layers: {} })).toBe(false);
    expect(hasIntelligenceData({ matricule: "X", layers: {} })).toBe(false);
    // Negative flags should not count as data.
    expect(
      hasIntelligenceData({
        layers: {},
        heritage: { nearby: false, count: 0, hasEip: false },
        contamination: { nearby: false, count: 0 },
        commercialVacancyNearby: 0,
      } as PropertyIntelligence),
    ).toBe(false);
  });

  it("returns true when any substantive layer is present", () => {
    expect(hasIntelligenceData({ assessment: { totalValue: 500_000 } })).toBe(true);
    expect(hasIntelligenceData({ zoning: { source: "pum2050" } })).toBe(true);
    expect(
      hasIntelligenceData({ heritage: { nearby: true, count: 2, hasEip: false } }),
    ).toBe(true);
    expect(hasIntelligenceData({ commercialVacancyNearby: 3 })).toBe(true);
  });
});

describe("dataWarn (silent-failure visibility)", () => {
  beforeEach(() => resetDataWarnCount());

  it("counts each warning emitted", () => {
    expect(getDataWarnCount()).toBe(0);
    dataWarn("fetchJson", { url: "https://example.test", status: 503 });
    dataWarn("fetchCkanPackage", { datasetId: "permits", status: 500 });
    expect(getDataWarnCount()).toBe(2);
  });
});

describe("Rng (deterministic seed)", () => {
  it("produces identical sequences for the same seed", () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = new Rng(hashSeed("permits:Montréal"));
    const b = new Rng(hashSeed("permits:Laval"));
    expect(a.next()).not.toEqual(b.next());
  });

  it("respects integer bounds and sampling sizes", () => {
    const r = new Rng(99);
    for (let i = 0; i < 100; i++) {
      const v = r.int(5, 9);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(9);
    }
    expect(r.sample([1, 2, 3], 2)).toHaveLength(2);
    expect(r.sample([1, 2, 3], 99)).toHaveLength(3);
  });
});
