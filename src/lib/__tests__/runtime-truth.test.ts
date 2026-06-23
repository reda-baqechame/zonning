import { describe, it, expect } from "vitest";
import { permitStatus, zoningStatus, type CoverageStatus } from "@/lib/runtime-truth";

describe("permitStatus classification (truth vocabulary)", () => {
  it("labels a city with no permit dataset as DOCUMENT_ONLY (never live)", () => {
    expect(permitStatus(null, 0, 0)).toBe("DOCUMENT_ONLY");
    // Even if some stray rows exist, no dataset wired ⇒ document-only.
    expect(permitStatus(null, 5, 5)).toBe("DOCUMENT_ONLY");
  });

  it("labels a wired-but-empty dataset as REGISTERED_NOT_SYNCED", () => {
    expect(permitStatus("permits-gatineau", 0, 0)).toBe("REGISTERED_NOT_SYNCED");
  });

  it("requires volume AND mappability for LIVE_INDEXED", () => {
    expect(permitStatus("permits", 5000, 4000)).toBe("LIVE_INDEXED");
    // Plenty of rows but none mappable ⇒ not live.
    expect(permitStatus("permits", 5000, 0)).toBe("PARTIAL_INDEXED");
    // Thin volume ⇒ partial, not live.
    expect(permitStatus("permits-laval", 40, 10)).toBe("PARTIAL_INDEXED");
  });

  it("never reports a document-only city as LIVE_INDEXED", () => {
    const docOnly = permitStatus(null, 99999, 99999);
    expect(docOnly).not.toBe("LIVE_INDEXED");
  });
});

describe("zoningStatus classification", () => {
  it("is DOCUMENT_ONLY with no points and PARTIAL_INDEXED with points", () => {
    expect(zoningStatus(0)).toBe("DOCUMENT_ONLY");
    expect(zoningStatus(10)).toBe("PARTIAL_INDEXED");
    expect(zoningStatus(500)).toBe("PARTIAL_INDEXED");
  });

  it("never claims LIVE_INDEXED for point-only zoning (no polygon truth yet)", () => {
    expect(zoningStatus(9999)).not.toBe("LIVE_INDEXED");
  });

  it("keeps the full audit status vocabulary available", () => {
    const statuses: CoverageStatus[] = [
      "LIVE_INDEXED",
      "PARTIAL_INDEXED",
      "DOCUMENT_ONLY",
      "REGISTERED_NOT_SYNCED",
      "COMING_SOON",
      "BROKEN",
    ];
    expect(statuses).toContain("COMING_SOON");
  });
});
