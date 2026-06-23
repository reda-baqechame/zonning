import { describe, expect, it } from "vitest";
import { profileFromUser } from "@/lib/quebec-qualification";

describe("profileFromUser", () => {
  it("maps existing user settings into a Quebec qualification profile", () => {
    const profile = profileFromUser(
      {
        id: "user_1",
        email: "owner@example.com",
        companyName: "Excavation Nord",
        trades: JSON.stringify(["excavation", "civil"]),
        regions: JSON.stringify(["Montreal", "Laval"]),
        rbqLicenseNumber: "1234-5678-90",
        rbqLicenseClass: "1.2.1, 2.7",
        rbqVerified: true,
        ampAuthorized: true,
        minProjectCost: 50000,
        maxProjectCost: 900000,
      },
      "en",
    );

    expect(profile.segment).toBe("specialty_contractor_or_supplier");
    expect(profile.trades).toEqual(["excavation", "civil"]);
    expect(profile.regions).toEqual(["Montreal", "Laval"]);
    expect(profile.rbqLicenseClasses).toEqual(["1.2.1", "2.7"]);
    expect(profile.publicPrivatePreference).toBe("both");
    expect(profile.notificationEmail).toBe("owner@example.com");
  });

  it("does not invent a complete profile for an anonymous visitor", () => {
    const profile = profileFromUser(null, "fr");

    expect(profile.companyName).toBeNull();
    expect(profile.trades).toEqual([]);
    expect(profile.regions).toEqual([]);
    expect(profile.rbqVerified).toBe(false);
    expect(profile.languagePreference).toBe("fr");
  });
});
