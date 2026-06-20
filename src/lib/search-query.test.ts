import { describe, expect, it } from "vitest";
import { looksLikeCivicAddress } from "./search-query";

describe("looksLikeCivicAddress", () => {
  it("accepts a civic address", () => {
    expect(looksLikeCivicAddress("500 boulevard René-Lévesque Ouest")).toBe(true);
  });

  it("does not turn business or municipality searches into property dossiers", () => {
    expect(looksLikeCivicAddress("RBQ plomberie Laval")).toBe(false);
    expect(looksLikeCivicAddress("Montréal")).toBe(false);
    expect(looksLikeCivicAddress("SEAO toiture Québec")).toBe(false);
  });
});
