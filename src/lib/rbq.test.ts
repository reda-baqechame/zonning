import { describe, expect, it } from "vitest";
import { computeRbqFitScore, getRequiredRbqClasses } from "./rbq";

describe("RBQ trade matching", () => {
  it.each(["Électricité", "electricite", "Travaux électriques"])(
    "matches accented electrical wording: %s",
    (permitType) => {
      expect(getRequiredRbqClasses(permitType)).toContain("4.1");
    },
  );

  it("matches any declared subclass in a multi-class profile", () => {
    expect(computeRbqFitScore("5.1, 4.1", ["4.1"]).eligible).toBe(true);
  });

  it("returns an unknown result instead of inventing a general requirement", () => {
    const result = computeRbqFitScore("4.1", []);
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(50);
  });
});
