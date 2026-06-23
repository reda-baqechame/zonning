import { describe, expect, it } from "vitest";
import { parseCsvRows, toCanadaBuysRecord } from "@/lib/datasets/fetchers/canadabuys";

const NOW = new Date("2026-06-23T12:00:00Z").getTime();

describe("toCanadaBuysRecord", () => {
  it("parses a well-formed open federal notice", () => {
    const rec = toCanadaBuysRecord(
      {
        reference_number: "TEND-12345",
        title_en: "Supply of widgets",
        buying_organization: "Public Services and Procurement Canada",
        region_of_delivery: "Ontario",
        procurement_method: "Open",
        closing_date: "2026-08-01",
        publication_date: "2026-06-20",
        estimated_value: 250000,
        unspsc: "43211500",
        status: "Open",
      },
      NOW,
    );
    expect(rec).not.toBeNull();
    expect(rec!.externalId).toBe("canadabuys-TEND-12345");
    expect(rec!.title).toBe("Supply of widgets");
    expect(rec!.organization).toBe("Public Services and Procurement Canada");
    expect(rec!.requiresAmp).toBe(false);
    expect(rec!.closesAt).toBeInstanceOf(Date);
  });

  it("skips cancelled/expired notices", () => {
    const cancelled = toCanadaBuysRecord(
      { reference_number: "X", title_en: "Y", status: "Cancelled" },
      NOW,
    );
    expect(cancelled).toBeNull();
  });

  it("skips notices that closed more than a week ago", () => {
    const old = toCanadaBuysRecord(
      { reference_number: "OLD", title_en: "Past tender", closing_date: "2020-01-01" },
      NOW,
    );
    expect(old).toBeNull();
  });

  it("returns null when there is no title or id", () => {
    expect(toCanadaBuysRecord({ status: "Open" }, NOW)).toBeNull();
    expect(toCanadaBuysRecord({ title_en: "No id" }, NOW)).toBeNull();
  });

  it("prefixes the external id to avoid collisions with SEAO", () => {
    const rec = toCanadaBuysRecord(
      { reference_number: "ABC", title_en: "Federal", status: "Open" },
      NOW,
    );
    expect(rec!.externalId.startsWith("canadabuys-")).toBe(true);
  });

  it("parses official CanadaBuys bilingual CSV rows with embedded newlines", () => {
    const rows = parseCsvRows(
      `"title-titre-eng","referenceNumber-numeroReference","publicationDate-datePublication","tenderClosingDate-appelOffresDateCloture","tenderStatus-appelOffresStatut-eng","contractingEntityName-nomEntitContractante-eng","regionsOfDelivery-regionsLivraison-eng","noticeURL-URLavis-eng","tenderDescription-descriptionAppelOffres-eng"\n` +
        `"Roof repairs","MX-444","2026-06-05","2026-07-15T14:00:00","Open","PSPC","Quebec","https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/mx-444","Line one\nLine two"`,
    );
    expect(rows).toHaveLength(1);

    const rec = toCanadaBuysRecord(rows[0], NOW);
    expect(rec).not.toBeNull();
    expect(rec!.externalId).toBe("canadabuys-MX-444");
    expect(rec!.title).toBe("Roof repairs");
    expect(rec!.organization).toBe("PSPC");
    expect(rec!.region).toBe("Quebec");
    expect(rec!.sourceUrl).toContain("canadabuys.canada.ca");
    expect(rec!.summary).toContain("Line two");
  });
});
