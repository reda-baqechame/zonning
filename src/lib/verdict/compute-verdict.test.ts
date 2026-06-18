import { describe, expect, it } from "vitest";
import { computeVerdictTier } from "./compute-verdict";
import type { PropertyIntelligence } from "@/lib/intelligence";

describe("computeVerdictTier", () => {
  it("returns bloque when multiple contamination sites nearby", () => {
    const intel: PropertyIntelligence = {
      contamination: { nearby: true, count: 3 },
    };
    expect(computeVerdictTier(intel).tier).toBe("bloque");
  });

  it("returns bloque when GTC contamination nearby", () => {
    const intel: PropertyIntelligence = {
      contamination: { nearby: true, count: 1, gtcNearby: true, gtcCount: 1 },
    };
    expect(computeVerdictTier(intel).tier).toBe("bloque");
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
