import { describe, expect, it } from "vitest";
import { buildZoningExpertAnalysis } from "./expert-analysis";

const now = new Date("2026-06-20T12:00:00Z");

describe("zoning expert analysis", () => {
  it("treats a nearby PUM centroid as planning context, not parcel zoning", () => {
    const result = buildZoningExpertAnalysis(
      {
        zoning: {
          source: "pum2050",
          densityThreshold: 180,
          description: "PUM 2050",
          sourceUrl: "https://donnees.montreal.ca/dataset/pum-2050",
          sourceFetchedAt: "2026-06-19T00:00:00Z",
          matchMethod: "nearest_centroid",
          matchDistanceMeters: 84,
          evidenceScope: "planning_area_nearby",
          determination: "indicative",
        },
      },
      { desiredUse: "Logement multifamilial", proposedFloors: 6 },
      now,
    );

    expect(result.status).toBe("indicative");
    expect(result.decision).toBe("not_determined");
    expect(result.canConcludeCompliance).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(55);
    expect(result.warnings).toContain("planning_not_regulation");
    expect(result.warnings).toContain("nearest_centroid_not_parcel");
  });

  it("returns unavailable instead of inventing zoning when no evidence exists", () => {
    const result = buildZoningExpertAnalysis({}, {}, now);
    expect(result.status).toBe("unavailable");
    expect(result.confidence).toBe(0);
    expect(result.evidence).toEqual([]);
  });

  it("does not mark overlays partial from empty proximity results", () => {
    const result = buildZoningExpertAnalysis(
      {
        heritage: { nearby: false, count: 0, hasEip: false },
        contamination: { nearby: false, count: 0, gtcNearby: false, gtcCount: 0 },
      },
      {},
      now,
    );

    expect(result.checks.find((check) => check.id === "overlays_and_constraints")?.status).toBe("missing");
  });

  it("does not infer compatibility without a verified use table", () => {
    const result = buildZoningExpertAnalysis(
      {
        matricule: "1234-56-7890",
        zoning: {
          source: "regional",
          zoneCode: "H-102",
          sourceUrl: "https://www.donneesquebec.ca/example",
          matchMethod: "nearest_centroid",
          evidenceScope: "planning_area_nearby",
          determination: "indicative",
        },
      },
      { desiredUse: "Commerce de detail" },
      now,
    );

    expect(result.decision).toBe("not_determined");
    expect(result.checks.find((check) => check.id === "parcel_identity")?.status).toBe("verified");
    expect(result.checks.find((check) => check.id === "permitted_use")?.status).toBe("missing");
  });
});
