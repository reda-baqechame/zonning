import { describe, expect, it } from "vitest";
import { cityIsHonestlyCovered, honestCoverageCount, citiesWithoutOpenFeed } from "@/lib/quebec-coverage";

describe("honest coverage invariant", () => {
  it("does not count document_only permit cities as honestly covered", () => {
    // Longueuil / Gatineau / Lévis are document_only in the registry.
    for (const city of ["Longueuil", "Gatineau", "Lévis"] as const) {
      expect(cityIsHonestlyCovered(city)).toBe(false);
    }
  });

  it("counts Montréal, Laval, Québec as honestly covered", () => {
    for (const city of ["Montréal", "Laval", "Québec"] as const) {
      expect(cityIsHonestlyCovered(city)).toBe(true);
    }
  });

  it("honestCoverageCount is <= 4 with current registry", () => {
    expect(honestCoverageCount()).toBeLessThanOrEqual(4);
  });

  it("citiesWithoutOpenFeed excludes the honestly covered cities", () => {
    const uncovered = citiesWithoutOpenFeed();
    expect(uncovered).not.toContain("Montréal");
    expect(uncovered).not.toContain("Laval");
    expect(uncovered).toContain("Longueuil");
  });
});
