import { describe, expect, it } from "vitest";
import { parsePermitRows } from "../city-permits";

describe("city permit ingestion contract", () => {
  it("rejects rows that only look complete because of placeholders", () => {
    const permits = parsePermitRows(
      "permits-laval",
      [
        { id: "bad-address", date_emission: "2026-06-01", type_travaux: "Rénovation" },
        { id: "bad-date", adresse: "10 rue Principale", type_travaux: "Rénovation" },
        { id: "bad-type", adresse: "10 rue Principale", date_emission: "2026-06-01" },
      ],
      10,
      { maxAgeDays: 3650 },
    );

    expect(permits).toEqual([]);
  });

  it("creates the same derived identity regardless of row order", () => {
    const row = {
      adresse: "10 avenue du Parc",
      type_travaux: "Agrandissement",
      date_emission: "2026-06-01",
    };
    const other = {
      id: "L-22",
      adresse: "22 rue Cartier",
      type_travaux: "Transformation",
      date_emission: "2026-05-20",
    };

    const first = parsePermitRows("permits-laval", [row, other], 10, { maxAgeDays: 3650 });
    const reordered = parsePermitRows("permits-laval", [other, row], 10, {
      maxAgeDays: 3650,
    });
    const derivedFirst = first.find((permit) => permit.address === row.adresse)?.externalId;
    const derivedReordered = reordered.find(
      (permit) => permit.address === row.adresse,
    )?.externalId;

    expect(derivedFirst).toMatch(/^derived:permits-laval:/);
    expect(derivedReordered).toBe(derivedFirst);
  });

  it("deduplicates a source ID and keeps the more complete row", () => {
    const permits = parsePermitRows(
      "permits-laval",
      [
        {
          id: "L-1",
          adresse: "100 boulevard Saint-Martin",
          type_travaux: "Rénovation",
          date_emission: "2026-06-01",
        },
        {
          id: "L-1",
          adresse: "100 boulevard Saint-Martin",
          type_travaux: "Rénovation",
          date_emission: "2026-06-01",
          cout_estime: "250 000 $",
        },
      ],
      10,
      { maxAgeDays: 3650 },
    );

    expect(permits).toHaveLength(1);
    expect(permits[0].estimatedCost).toBe(250_000);
  });
});
