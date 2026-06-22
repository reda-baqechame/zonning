import { describe, expect, it } from "vitest";
import { computeVerdictTier } from "./compute-verdict";
import type { PropertyIntelligence } from "@/lib/intelligence";

describe("computeVerdictTier", () => {
  it("returns insufficient_data when no evidence is available", () => {
    const intel: PropertyIntelligence = {};
    const result = computeVerdictTier(intel);
    expect(result.tier).toBe("insufficient_data");
    expect(result.confidence).toBe(0);
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("does not call a parcel blocked from nearby contamination records", () => {
    const intel: PropertyIntelligence = {
      contamination: { nearby: true, count: 3 },
    };
    const result = computeVerdictTier(intel);
    expect(result.tier).not.toBe("bloque");
    expect(result.limitations.join(" ")).toContain("proximity only");
  });

  it("does not call a parcel contaminated from a nearby GTC entry", () => {
    const intel: PropertyIntelligence = {
      contamination: { nearby: true, count: 1, gtcNearby: true, gtcCount: 1 },
    };
    const result = computeVerdictTier(intel);
    expect(result.tier).not.toBe("bloque");
    expect(result.reasonsEn.join(" ")).toContain("parcel match not established");
  });

  it("returns eleve for clean intel with hot market", () => {
    const intel: PropertyIntelligence = {
      marketHeat: { level: "hot", permitCount: 40 },
      recentTransaction: { salePrice: 750_000 },
      assessment: { totalValue: 1_200_000 },
    };
    expect(computeVerdictTier(intel).tier).toBe("eleve");
  });
});
