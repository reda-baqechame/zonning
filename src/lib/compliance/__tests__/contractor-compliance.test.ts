import { describe, expect, it, vi, beforeEach } from "vitest";
import { assembleCompliance } from "@/lib/compliance/contractor-compliance";

const deps = {
  findRena: vi.fn(),
  findEnterprise: vi.fn(),
  findSanctions: vi.fn().mockResolvedValue([]),
  findConvictions: vi.fn().mockResolvedValue([]),
  findInjuries: vi.fn().mockResolvedValue(null),
  findAwards: vi.fn().mockResolvedValue({ count: 0, totalValue: 0, recent: [] }),
  findRbq: vi.fn(),
};

describe("assembleCompliance", () => {
  beforeEach(() => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue(null);
    deps.findSanctions.mockResolvedValue([]);
    deps.findConvictions.mockResolvedValue([]);
    deps.findInjuries.mockResolvedValue(null);
    deps.findAwards.mockResolvedValue({ count: 0, totalValue: 0, recent: [] });
    deps.findRbq.mockResolvedValue(null);
  });

  it("marks RENA-active NEQ as non-eligible + high risk", async () => {
    deps.findRena.mockResolvedValue({ active: true, offence: "fraude", startDate: new Date("2025-01-01") });
    deps.findEnterprise.mockResolvedValue({ neq: "1234", name: "ABC", legalStatus: "Immatriculée" });
    const r = await assembleCompliance({ neq: "1234" }, deps);
    expect(r.publicBidEligible).toBe(false);
    expect(r.overallRisk).toBe("high");
    expect(r.renaNonAdmissible?.active).toBe(true);
  });

  it("marks a clean NEQ as eligible + low risk", async () => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue({ neq: "1234", name: "ABC", legalStatus: "Immatriculée" });
    const r = await assembleCompliance({ neq: "1234" }, deps);
    expect(r.publicBidEligible).toBe(true);
    expect(r.overallRisk).toBe("low");
  });

  it("resolves NEQ from an RBQ license number when neq not given", async () => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue(null);
    const r = await assembleCompliance({ licenseNumber: "1234-5678-01" }, deps);
    expect(r.neq).toBe("1234");
  });

  it("returns unknown risk when no data is found", async () => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue(null);
    deps.findSanctions.mockResolvedValue([]);
    deps.findConvictions.mockResolvedValue([]);
    deps.findRbq.mockResolvedValue(null);
    const r = await assembleCompliance({ neq: "0000" }, deps);
    expect(r.overallRisk).toBe("unknown");
  });
});
