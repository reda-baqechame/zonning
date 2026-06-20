import { describe, expect, it } from "vitest";
import {
  assessPermitQuality,
  buildPermitExternalId,
  hasUsableAddress,
} from "./quality";

const now = new Date("2026-06-20T12:00:00Z");

describe("permit quality contract", () => {
  it("grades a complete official dataset record without claiming a record-level source", () => {
    const quality = assessPermitQuality(
      {
        externalId: "P-123",
        permitNumber: "P-123",
        permitType: "Rénovation commerciale",
        address: "100 rue Sainte-Catherine O",
        city: "Montréal",
        latitude: 45.5,
        longitude: -73.57,
        estimatedCost: 250_000,
        issueDate: new Date("2026-06-18T12:00:00Z"),
        sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
      },
      now,
    );

    expect(quality.grade).toBe("high");
    expect(quality.usable).toBe(true);
    expect(quality.officialSource).toBe(true);
    expect(quality.sourceScope).toBe("dataset");
    expect(quality.issues).toContain("dataset_level_source");
  });

  it("rejects city-name and missing-date placeholders", () => {
    const quality = assessPermitQuality(
      {
        externalId: "row-1",
        permitType: "Construction",
        address: "Montréal",
        city: "Montréal",
        sourceUrl: "https://www.donneesquebec.ca/example",
      },
      now,
    );

    expect(quality.usable).toBe(false);
    expect(quality.grade).toBe("low");
    expect(quality.issues).toContain("placeholder_address");
    expect(quality.issues).toContain("missing_issue_date");
  });

  it("builds stable derived IDs from actual record evidence", () => {
    const input = {
      city: "Laval",
      address: "10 avenue du Parc",
      permitType: "Agrandissement",
      issueDate: new Date("2026-06-01T00:00:00Z"),
    };
    expect(buildPermitExternalId("permits-laval", null, input)).toBe(
      buildPermitExternalId("permits-laval", null, input),
    );
  });

  it("does not build IDs from placeholders", () => {
    expect(
      buildPermitExternalId("permits", null, {
        city: "Montréal",
        address: "Montréal",
        permitType: "Construction",
        issueDate: now,
      }),
    ).toBeNull();
    expect(hasUsableAddress("Québec")).toBe(false);
  });
});
