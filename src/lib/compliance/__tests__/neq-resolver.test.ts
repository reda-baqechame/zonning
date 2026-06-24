import { describe, expect, it, vi } from "vitest";
import { rbqToNeq, findEnterpriseByNeq, nameToNeq } from "@/lib/compliance/neq-resolver";

describe("rbqToNeq", () => {
  it("derives the NEQ prefix from an RBQ license number", () => {
    expect(rbqToNeq("1234-5678-01")).toBe("1234");
  });
  it("returns null for malformed RBQ numbers", () => {
    expect(rbqToNeq("")).toBeNull();
    expect(rbqToNeq("abc")).toBeNull();
    expect(rbqToNeq(null)).toBeNull();
    expect(rbqToNeq(undefined)).toBeNull();
  });
});

describe("findEnterpriseByNeq", () => {
  it("returns the enterprise record when found", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: "1", neq: "1234", name: "ABC Inc.", legalStatus: "Immatriculée" });
    const r = await findEnterpriseByNeq("1234", lookup);
    expect(r?.neq).toBe("1234");
  });
  it("returns null when not found", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    expect(await findEnterpriseByNeq("9999", lookup)).toBeNull();
  });
});

describe("nameToNeq", () => {
  it("returns ranked candidates with confidence, never a single asserted match", async () => {
    const search = vi.fn().mockResolvedValue([
      { id: "1", neq: "1234", name: "ABC CONSTRUCTION INC.", legalStatus: "Immatriculée" },
      { id: "2", neq: "5555", name: "ABC PLOMBERIE", legalStatus: "Immatriculée" },
    ]);
    const r = await nameToNeq("ABC CONSTRUCTION", search);
    expect(r.length).toBe(2);
    expect(r[0]).toHaveProperty("confidence");
    expect(["high", "medium", "low"]).toContain(r[0].confidence);
  });

  it("ranks exact normalized match highest", async () => {
    const search = vi.fn().mockResolvedValue([
      { id: "1", neq: "5555", name: "ABC PLOMBERIE" },
      { id: "2", neq: "1234", name: "ABC CONSTRUCTION" },
    ]);
    const r = await nameToNeq("ABC CONSTRUCTION", search);
    expect(r[0].neq).toBe("1234");
    expect(r[0].confidence).toBe("high");
  });

  it("returns empty for an empty query", async () => {
    const search = vi.fn().mockResolvedValue([]);
    expect(await nameToNeq("", search)).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });
});
