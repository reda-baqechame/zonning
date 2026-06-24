import { describe, expect, it, vi } from "vitest";
import { assessParcel } from "@/lib/compliance/parcel-verdict";

describe("assessParcel", () => {
  it("returns constraint_present when a contaminated site is near", async () => {
    const findContaminated = vi
      .fn()
      .mockResolvedValue([{ id: "c1", name: "Site X", sourceUrl: "http://s" }]);
    const findHeritage = vi.fn().mockResolvedValue([]);
    const r = await assessParcel(46.8, -71.2, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("constraint_present");
    expect(r.constraints.some((c) => c.kind === "contamination")).toBe(true);
  });

  it("returns clear when no layers flag and layers were checked", async () => {
    const findContaminated = vi.fn().mockResolvedValue([]);
    const findHeritage = vi.fn().mockResolvedValue([]);
    const r = await assessParcel(45.5, -73.6, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("clear");
    expect(r.constraints).toEqual([]);
  });

  it("returns unknown_layer when a layer lookup threw", async () => {
    const findContaminated = vi.fn().mockRejectedValue(new Error("db down"));
    const findHeritage = vi.fn().mockResolvedValue([]);
    const r = await assessParcel(45.5, -73.6, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("unknown_layer");
  });

  it("flags heritage constraint", async () => {
    const findContaminated = vi.fn().mockResolvedValue([]);
    const findHeritage = vi
      .fn()
      .mockResolvedValue([{ id: "h1", name: "Maison XYZ", sourceUrl: "http://h" }]);
    const r = await assessParcel(45.5, -73.6, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("constraint_present");
    expect(r.constraints.some((c) => c.kind === "heritage")).toBe(true);
  });
});
