import { describe, expect, it } from "vitest";
import type { SiteDossier } from "@/lib/domain/quebec";
import type { PropertyIntelligence } from "@/lib/intelligence";
import { buildZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";
import { summarizeSiteEvidence } from "./v2";

const noPermits: SiteDossier["permits"] = [];

describe("summarizeSiteEvidence", () => {
  it("does not treat negative proximity results as evidence", () => {
    const intel: PropertyIntelligence = {
      contamination: { nearby: false, count: 0, gtcNearby: false, gtcCount: 0 },
      heritage: { nearby: false, count: 0, hasEip: false, lpcProtected: false, pum2050Listed: false },
      roadworks: { nearby: false, count: 0 },
    };

    expect(summarizeSiteEvidence(intel, noPermits, buildZoningExpertAnalysis(intel))).toEqual({
      parcelSignals: 0,
      addressMatchedPermits: 0,
      contextualSignals: 0,
      decisionConfidence: 0,
      canIssueParcelConclusion: false,
    });
  });

  it("caps nearby context below parcel-level confidence", () => {
    const intel: PropertyIntelligence = {
      contamination: { nearby: true, count: 1, gtcNearby: true, gtcCount: 1 },
    };

    const summary = summarizeSiteEvidence(intel, noPermits, buildZoningExpertAnalysis(intel));
    expect(summary.parcelSignals).toBe(0);
    expect(summary.contextualSignals).toBe(1);
    expect(summary.decisionConfidence).toBeLessThanOrEqual(0.35);
    expect(summary.canIssueParcelConclusion).toBe(false);
  });

  it("counts parcel records and address-matched permits as direct evidence", () => {
    const intel: PropertyIntelligence = { assessment: { totalValue: 800_000 } };
    const permits: SiteDossier["permits"] = [
      {
        id: "permit-1",
        stage: "issuance",
        title: "Renovation permit",
        municipality: "Montreal",
        address: "500 boulevard Rene-Levesque Ouest",
        value: 125_000,
        date: "2026-01-15T00:00:00.000Z",
        participants: [],
        documents: [],
        confidence: 0.82,
        source: { id: "permit-1", title: "Municipal permit", url: "https://example.test/permit-1" },
      },
    ];

    const summary = summarizeSiteEvidence(intel, permits, buildZoningExpertAnalysis(intel));
    expect(summary.parcelSignals).toBe(1);
    expect(summary.addressMatchedPermits).toBe(1);
    expect(summary.decisionConfidence).toBeGreaterThan(0.5);
  });

  it("uses confirmed parcel zoning confidence without claiming compliance", () => {
    const intel: PropertyIntelligence = {
      zoning: {
        source: "regional",
        zoneCode: "C-12",
        evidenceScope: "parcel",
        determination: "confirmed",
        matchMethod: "parcel_intersection",
        sourceUrl: "https://example.test/bylaw",
      },
    };
    const zoning = buildZoningExpertAnalysis(intel);
    const summary = summarizeSiteEvidence(intel, noPermits, zoning);

    expect(summary.parcelSignals).toBe(1);
    expect(summary.decisionConfidence).toBe(zoning.confidence / 100);
    expect(summary.canIssueParcelConclusion).toBe(false);
  });
});
