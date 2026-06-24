import { describe, expect, it } from "vitest";
import { parseTriageLink } from "@/lib/triage/link-parser";

describe("parseTriageLink", () => {
  it("detects a SEAO link with an id", () => {
    const r = parseTriageLink("https://seao.ca/avis/1234567");
    expect(r.source).toBe("seao");
    expect(r.sourceId).toBe("1234567");
    expect(r.resolvable).toBe(true);
    expect(r.looksLikeOpportunity).toBe(true);
  });

  it("detects a SEAO link via query param", () => {
    const r = parseTriageLink("seao.ca/recherche?id=987654");
    expect(r.source).toBe("seao");
    expect(r.sourceId).toBe("987654");
  });

  it("detects a CanadaBuys link", () => {
    const r = parseTriageLink("https://canadabuys.canada.ca/en/tender-notices/abc-123");
    expect(r.source).toBe("canadabuys");
    expect(r.sourceId).toBe("abc-123");
    expect(r.resolvable).toBe(true);
  });

  it("detects a municipal link as non-resolvable", () => {
    const r = parseTriageLink("https://ville.quebec.qc.ca/appels-d-offres/xyz?id=5");
    expect(r.source).toBe("municipal");
    expect(r.resolvable).toBe(false);
    expect(r.looksLikeOpportunity).toBe(true);
  });

  it("returns unknown for a non-tender url", () => {
    const r = parseTriageLink("https://example.com/about");
    expect(r.source).toBe("unknown");
    expect(r.resolvable).toBe(false);
  });

  it("detects seao.gouv.qc.ca ItemId UUID", () => {
    const url =
      "https://seao.gouv.qc.ca/avis/consulter?ItemId=b65c1ab0-3108-4a2e-9f3a-1c2d3e4f5a6b";
    const r = parseTriageLink(url);
    expect(r.source).toBe("seao");
    expect(r.sourceId).toBe("b65c1ab0-3108-4a2e-9f3a-1c2d3e4f5a6b");
    expect(r.resolvable).toBe(true);
    expect(r.looksLikeOpportunity).toBe(true);
  });

  it("does not classify seao.gouv.qc.ca as municipal", () => {
    const r = parseTriageLink("https://seao.gouv.qc.ca/recherche");
    expect(r.source).not.toBe("municipal");
    expect(r.source).toBe("seao");
  });

  it("returns unknown for garbage", () => {
    const r = parseTriageLink("   ");
    expect(r.source).toBe("unknown");
    expect(r.sourceId).toBeNull();
  });
});
