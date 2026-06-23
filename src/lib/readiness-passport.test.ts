import { describe, expect, it } from "vitest";
import { buildGovernmentReadinessPassport } from "@/lib/readiness-passport";

describe("buildGovernmentReadinessPassport", () => {
  it("marks an incomplete business as blocked before document spend", () => {
    const passport = buildGovernmentReadinessPassport(
      {
        companyName: null,
        email: "owner@example.test",
        rbqLicenseClass: null,
        rbqLicenseNumber: null,
        rbqVerified: false,
        trades: [],
        regions: [],
        ampAuthorized: false,
        minProjectCost: null,
        maxProjectCost: null,
      },
      "en",
    );

    expect(passport.status).toBe("blocked");
    expect(passport.score).toBeLessThan(45);
    expect(passport.headline).toContain("too incomplete");
    expect(passport.missingItems.join(" ")).toContain("RBQ licence number");
    expect(passport.blockers.join(" ")).toContain("Incomplete RBQ");
    expect(passport.nextActions.map((action) => action.id)).toContain("amp");
  });

  it("gives a stronger score when the core bidding profile is complete", () => {
    const passport = buildGovernmentReadinessPassport(
      {
        companyName: "Construction Test",
        email: "ops@example.test",
        rbqLicenseClass: "1.3",
        rbqLicenseNumber: "1234-5678-01",
        rbqVerified: true,
        trades: ["construction"],
        regions: ["Montréal"],
        ampAuthorized: true,
        minProjectCost: 100_000,
        maxProjectCost: 2_000_000,
      },
      "en",
    );

    expect(passport.score).toBe(80);
    expect(passport.status).toBe("ready");
    expect(passport.readyItems.join(" ")).toContain("RBQ licence is verified");
    expect(passport.missingItems.join(" ")).toContain("Revenu Québec");
    expect(passport.officialSites.map((site) => site.id)).toEqual([
      "seao",
      "amp",
      "rbq",
    ]);
  });
});
