import { describe, expect, it } from "vitest";
import {
  parseCoordinate,
  repairIntegerCollapsed,
  isValidCoordinate,
} from "@/lib/permits/coordinate";

describe("parseCoordinate", () => {
  it("parses a normal WGS84 decimal", () => {
    expect(parseCoordinate("45.5017")).toBeCloseTo(45.5017, 5);
    expect(parseCoordinate("-73.5673")).toBeCloseTo(-73.5673, 5);
  });

  it("parses high-precision Québec coordinates without integer collapse", () => {
    // These are the exact values parseLocaleNumber was mangling into
    // 4675216566177939 / -7132845142525129.
    expect(parseCoordinate("46.75216566177939")).toBeCloseTo(46.75216566177939, 10);
    expect(parseCoordinate("-71.63845140691465")).toBeCloseTo(-71.63845140691465, 10);
  });

  it("returns undefined for garbage", () => {
    expect(parseCoordinate("")).toBeUndefined();
    expect(parseCoordinate("Montréal")).toBeUndefined();
    expect(parseCoordinate(null)).toBeUndefined();
    expect(parseCoordinate(undefined)).toBeUndefined();
  });
});

describe("repairIntegerCollapsed", () => {
  it("repairs an integer-collapsed latitude like 4675216566177939", () => {
    // value came from parseLocaleNumber mangling 46.75216566177939
    expect(repairIntegerCollapsed(4675216566177939, "lat")).toBeCloseTo(46.75216566177939, 8);
  });

  it("repairs an integer-collapsed longitude like -7132845142525129", () => {
    expect(repairIntegerCollapsed(-7132845142525129, "lon")).toBeCloseTo(-71.32845142525129, 8);
  });

  it("returns undefined for a value already in range", () => {
    expect(repairIntegerCollapsed(45.5, "lat")).toBeUndefined();
    expect(repairIntegerCollapsed(-73.6, "lon")).toBeUndefined();
  });
});

describe("isValidCoordinate", () => {
  it("accepts valid lat/lon ranges", () => {
    expect(isValidCoordinate(45.5, -73.5)).toBe(true);
  });

  it("rejects out-of-range", () => {
    expect(isValidCoordinate(91, -73.5)).toBe(false);
    expect(isValidCoordinate(45.5, -181)).toBe(false);
  });

  it("rejects non-numbers", () => {
    expect(isValidCoordinate("45", -73.5)).toBe(false);
    expect(isValidCoordinate(NaN, -73.5)).toBe(false);
  });
});
