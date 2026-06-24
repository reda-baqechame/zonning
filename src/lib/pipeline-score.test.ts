import { describe, expect, it } from "vitest";
import { computePipelineScore } from "./pipeline-score";

const now = new Date("2026-06-20T12:00:00Z");
const verifiedProfile = {
  rbqLicenseClass: "4.1",
  rbqLicenseNumber: "1234-5678-01",
  rbqVerified: true,
  minProjectCost: 50_000,
  maxProjectCost: 500_000,
};

describe("computePipelineScore", () => {
  it("produces a high-confidence rank from complete matching evidence", async () => {
    const result = await computePipelineScore(
      {
        permitType: "Électricité",
        estimatedCost: 180_000,
        issueDate: new Date("2026-06-18T12:00:00Z"),
      },
      verifiedProfile,
      {
        assessment: { totalValue: 800_000, floors: 2 },
        zoning: {
          source: "regional",
          maxFloors: 6,
          determination: "confirmed",
          evidenceScope: "parcel",
        },
        recentTransaction: { salePrice: 750_000 },
      },
      { competitionCount: 14, now },
    );

    expect(result.confidence).toBe(100);
    expect(result.confidenceLevel).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.reasons.map((reason) => reason.id)).toContain(
      "verified_rbq_match",
    );
  });

  it("does not score planning context as parcel-level zoning capacity", async () => {
    const result = await computePipelineScore(
      {
        permitType: "Électricité",
        estimatedCost: 180_000,
        issueDate: new Date("2026-06-18T12:00:00Z"),
      },
      verifiedProfile,
      {
        assessment: { totalValue: 800_000, floors: 2 },
        zoning: {
          source: "pum2050",
          intensificationLevel: "élevée",
          densityThreshold: 180,
          determination: "indicative",
          evidenceScope: "planning_area_nearby",
        },
      },
      { competitionCount: 14, now },
    );

    expect(result.breakdown.zoning).toBeNull();
    expect(result.densityGap).toBe("unknown");
    expect(result.reasons.map((reason) => reason.id)).not.toContain("site_upside");
  });

  it("does not turn generic unprofiled permits into strong opportunities", async () => {
    const result = await computePipelineScore(
      { permitType: "Construction" },
      {},
      undefined,
      { competitionCount: 0, now },
    );

    expect(result.breakdown.rbqFit).toBeLessThan(50);
    expect(result.breakdown.costFit).toBeNull();
    expect(result.breakdown.freshness).toBeNull();
    expect(result.breakdown.intelligence).toBeNull();
    expect(result.breakdown.zoning).toBeNull();
    expect(result.confidenceLevel).toBe("low");
    expect(result.score).toBeLessThanOrEqual(38);
    expect(result.reasons.map((reason) => reason.id)).toContain(
      "limited_evidence",
    );
  });

  it("caps low-signal municipal permits even when they are fresh", async () => {
    const result = await computePipelineScore(
      {
        permitType: "Certificat d'autorisation",
        estimatedCost: 250_000,
        issueDate: new Date("2026-06-19T12:00:00Z"),
      },
      {},
      undefined,
      { competitionCount: 15, now, dataQualityScore: 80 },
    );

    expect(result.score).toBeLessThanOrEqual(38);
    expect(result.breakdown.rbqFit).toBeLessThan(30);
  });

  it("ranks a fresh permit above the same stale permit", async () => {
    const base = { permitType: "Électricité", estimatedCost: 100_000 };
    const fresh = await computePipelineScore(
      { ...base, issueDate: new Date("2026-06-19T12:00:00Z") },
      verifiedProfile,
      undefined,
      { competitionCount: 8, now },
    );
    const stale = await computePipelineScore(
      { ...base, issueDate: new Date("2026-02-01T12:00:00Z") },
      verifiedProfile,
      undefined,
      { competitionCount: 8, now },
    );

    expect(fresh.score).toBeGreaterThan(stale.score);
    expect(stale.reasons.map((reason) => reason.id)).toContain("stale_record");
  });

  it("applies proportional nearby risk without calling it a verified site constraint", async () => {
    const permit = {
      permitType: "Électricité",
      estimatedCost: 100_000,
      issueDate: new Date("2026-06-19T12:00:00Z"),
    };
    const clean = await computePipelineScore(
      permit,
      verifiedProfile,
      { assessment: { totalValue: 700_000 } },
      { competitionCount: 8, now },
    );
    const constrained = await computePipelineScore(
      permit,
      verifiedProfile,
      {
        assessment: { totalValue: 700_000 },
        contamination: { nearby: true, count: 1, gtcNearby: true, gtcCount: 1 },
        heritage: { nearby: true, count: 1, hasEip: true, lpcProtected: true },
      },
      { competitionCount: 8, now },
    );

    expect(clean.score).toBeGreaterThan(constrained.score);
    expect(constrained.reasons.map((reason) => reason.id)).not.toContain(
      "site_constraints",
    );
  });

  it("reduces ranking confidence when the source record is incomplete", async () => {
    const permit = {
      permitType: "Électricité",
      estimatedCost: 100_000,
      issueDate: new Date("2026-06-19T12:00:00Z"),
    };
    const strong = await computePipelineScore(permit, verifiedProfile, undefined, {
      competitionCount: 8,
      now,
      dataQualityScore: 100,
    });
    const weak = await computePipelineScore(permit, verifiedProfile, undefined, {
      competitionCount: 8,
      now,
      dataQualityScore: 35,
    });

    expect(weak.confidence).toBeLessThan(strong.confidence);
    expect(weak.score).toBeLessThan(strong.score);
    expect(weak.recordQualityScore).toBe(35);
  });
});
