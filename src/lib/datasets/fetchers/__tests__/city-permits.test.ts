import { describe, expect, it } from "vitest";
import { parseLavalPermitRows, parsePermitRows } from "../city-permits";

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

  it("maps the current Laval CSV schema", () => {
    const permits = parsePermitRows(
      "permits-laval",
      [
        {
          no_permis: "PN-2026-1001",
          type_permis: "PN",
          type_permis_descr: "Permis de construction - nouvelle",
          date_emission: "2026-05-15",
          cout_permis: "125000.00",
          adresse: "100 Boulevard Saint-Martin",
          entrepreneur: "Construction Exemple inc.",
        },
      ],
      10,
      { maxAgeDays: 3650 },
    );

    expect(permits).toHaveLength(1);
    expect(permits[0]).toMatchObject({
      externalId: "permits-laval-PN-2026-1001",
      permitNumber: "PN-2026-1001",
      permitType: "Permis de construction - nouvelle",
      estimatedCost: 125_000,
      city: "Laval",
    });
  });

  it("selects recent Laval rows even when the official CSV is not date ordered", () => {
    const csv = [
      '"NO_PERMIS","TYPE_PERMIS","TYPE_PERMIS_DESCR","CATEGORIE_BATIMENT","TYPE_BATIMENT",DATE_EMISSION,"STRUCTURE",COUT_PERMIS,"NOMBRE_ETAGES","NOMBRE_LOGEMENTS","SUP_CA","LOTS","ENTREPRENEUR","ADRESSE"',
      '"PA-1993-0001","PA","Permis de construction - amélioration","Bâtiment","Habitation",1993-03-31,"",50.00,,,,,"","1 Rue Ancienne"',
      '"PN-2026-1001","PN","Permis de construction - nouvelle","Habitation","Habitation",2026-05-15,"",125000.00,,,,,"Construction Exemple inc.","100 Boulevard Saint-Martin"',
      '"PA-1993-0002","PA","Permis de construction - amélioration","Bâtiment","Habitation",1993-04-01,"",75.00,,,,,"","2 Rue Ancienne"',
    ].join("\n");

    const rows = parseLavalPermitRows(csv, 10, { maxAgeDays: 3650 });
    const permits = parsePermitRows("permits-laval", rows, 10, { maxAgeDays: 3650 });

    expect(permits).toHaveLength(1);
    expect(permits[0].permitNumber).toBe("PN-2026-1001");
  });
});
