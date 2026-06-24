import { describe, expect, it } from "vitest";
import { estimatePermitValue } from "@/lib/permits/value-estimate";

const basePermit = {
  permitType: "Permis de construction",
  workType: "Construction résidentielle",
  city: "Montréal" as string | null,
  borough: "Ville-Marie" as string | null,
  estimatedCost: null as number | null,
};

describe("estimatePermitValue", () => {
  it("returns published when the source has a cost", () => {
    const r = estimatePermitValue({ ...basePermit, estimatedCost: 250000 });
    expect(r.kind).toBe("published");
    if (r.kind === "published") expect(r.value).toBe(250000);
  });

  it("returns an estimated band for a known residential construction type", () => {
    const r = estimatePermitValue(basePermit);
    expect(r.kind).toBe("estimated");
    if (r.kind === "estimated") {
      expect(r.low).toBeGreaterThan(0);
      expect(r.high).toBeGreaterThan(r.low);
      expect(r.basis.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(r.confidence);
    }
  });

  it("returns unknown for an unrecognized type", () => {
    const r = estimatePermitValue({
      ...basePermit,
      permitType: "zzz not a real type zzz",
      workType: "",
    });
    expect(r.kind).toBe("unknown");
  });

  it("never returns an estimated exact single number", () => {
    const r = estimatePermitValue(basePermit);
    if (r.kind === "estimated") {
      expect(r).not.toHaveProperty("value");
    }
  });

  it("applies RBQ complexity multiplier upward for new residential", () => {
    const withoutRbq = estimatePermitValue(basePermit);
    const withRbq = estimatePermitValue(basePermit, { rbqClasses: ["1.1.1"] });
    if (withoutRbq.kind === "estimated" && withRbq.kind === "estimated") {
      expect(withRbq.high).toBeGreaterThanOrEqual(withoutRbq.high);
    }
  });
});
