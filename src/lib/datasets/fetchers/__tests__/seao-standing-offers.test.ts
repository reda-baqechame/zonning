import { describe, expect, it } from "vitest";
import { standingOffersSource } from "../seao-standing-offers";

describe("SEAO standing-offer freshness", () => {
  it("treats a healthy bundle with no matching offers as unchanged", () => {
    expect(standingOffersSource(0, 4)).toBe("unchanged");
  });

  it("distinguishes live records from an unavailable bundle", () => {
    expect(standingOffersSource(3, 4)).toBe("live");
    expect(standingOffersSource(0, 0)).toBe("empty");
  });
});
