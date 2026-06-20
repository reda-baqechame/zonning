import { describe, expect, it } from "vitest";
import { addressMatchesCandidate } from "./geocode";

describe("addressMatchesCandidate", () => {
  it("accepts the same civic number and street name", () => {
    expect(
      addressMatchesCandidate(
        "500 boul. René-Lévesque Ouest",
        "500 boulevard René-Lévesque Ouest, Montréal, Québec"
      )
    ).toBe(true);
  });

  it("rejects a geocoder suggestion with a different civic number", () => {
    expect(
      addressMatchesCandidate(
        "99999 rue inexistante",
        "9999 rue de Lille, Montréal H2B 2P8"
      )
    ).toBe(false);
  });

  it("rejects a different street even when the civic number matches", () => {
    expect(
      addressMatchesCandidate(
        "500 rue Clark",
        "500 rue Saint-Denis, Montréal"
      )
    ).toBe(false);
  });
});
