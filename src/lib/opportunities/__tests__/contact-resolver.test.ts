import { describe, expect, it, vi } from "vitest";
import {
  resolveContactLeads,
  rbqClassMatches,
} from "@/lib/opportunities/contact-resolver";

describe("rbqClassMatches", () => {
  it("matches exact subclass", () => {
    expect(rbqClassMatches("1.1.1", ["1.1.1", "4.1"])).toBe(true);
  });
  it("matches sibling subclass in same family", () => {
    expect(rbqClassMatches("1.1.1", ["1.1.3"])).toBe(true);
    expect(rbqClassMatches("1.1.1", ["1.1"])).toBe(true);
  });
  it("does not match unrelated family", () => {
    expect(rbqClassMatches("1.1.1", ["4.1", "6.1"])).toBe(false);
  });
});

describe("resolveContactLeads", () => {
  it("returns licensed contractors for a permit's required RBQ classes", async () => {
    const findLicensees = vi.fn().mockResolvedValue([
      {
        id: "1",
        holderName: "ABC Construction",
        licenseNumber: "1234-5678-01",
        subclass: "1.1.1",
        status: "active",
        sourceUrl: "https://www.rbq.gouv.qc.ca/",
      },
      {
        id: "2",
        holderName: "XYZ Électrique",
        licenseNumber: "9999-8888-01",
        subclass: "4.1",
        status: "active",
        sourceUrl: "https://www.rbq.gouv.qc.ca/",
      },
    ]);
    const r = await resolveContactLeads(
      { kind: "permit", permitId: "p1", requiredRbqClasses: ["1.1.1"] },
      { findLicensees, findAward: vi.fn().mockResolvedValue(null), limit: 5 },
    );
    expect(r.permit).toBeDefined();
    expect(r.permit?.licensedContractors.map((c) => c.holderName)).toEqual([
      "ABC Construction",
    ]);
    expect(r.permit?.note).toContain("licence RBQ");
  });

  it("returns the awarded contractor for a tender with an award", async () => {
    const findAward = vi.fn().mockResolvedValue({
      winnerName: "Gros œuvre inc.",
      awardDate: new Date("2026-05-01"),
      awardAmount: 420000,
    });
    const r = await resolveContactLeads(
      {
        kind: "tender",
        tenderId: "t1",
        organization: "Ville de Montréal",
        sourceUrl: "https://www.seao.ca/1",
      },
      { findLicensees: vi.fn().mockResolvedValue([]), findAward, limit: 5 },
    );
    expect(r.tender?.awardedContractor?.name).toBe("Gros œuvre inc.");
    expect(r.tender?.buyer).toBe("Ville de Montréal");
  });

  it("permit note states these are NOT the applicant", async () => {
    const r = await resolveContactLeads(
      { kind: "permit", permitId: "p1", requiredRbqClasses: ["1.1.1"] },
      {
        findLicensees: vi.fn().mockResolvedValue([]),
        findAward: vi.fn().mockResolvedValue(null),
        limit: 5,
      },
    );
    expect(r.permit?.note).toMatch(/titulaires|licensed|licence/i);
    expect(r.permit?.licensedContractors).toEqual([]);
  });

  it("excludes non-active licensees", async () => {
    const findLicensees = vi.fn().mockResolvedValue([
      {
        id: "1",
        holderName: "Expired Inc.",
        licenseNumber: "x",
        subclass: "1.1.1",
        status: "expired",
        sourceUrl: "u",
      },
    ]);
    const r = await resolveContactLeads(
      { kind: "permit", permitId: "p1", requiredRbqClasses: ["1.1.1"] },
      { findLicensees, findAward: vi.fn().mockResolvedValue(null), limit: 5 },
    );
    expect(r.permit?.licensedContractors).toEqual([]);
  });
});
