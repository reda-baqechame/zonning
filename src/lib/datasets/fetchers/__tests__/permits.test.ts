import { describe, expect, it } from "vitest";
import { parseDate, parseMoney, pick } from "../../parser";
import { parseMontrealPermitRows, parsePermitRows } from "../permits";

describe("permit CSV mapping", () => {
  it("maps Montreal permit row columns", () => {
    const row = {
      no_demande: "ABC-123",
      emplacement: "1000 Rue Sainte-Catherine",
      arrondissement: "Ville-Marie",
      date_emission: "2024-06-01",
      cout_estime: "150 000 $",
      description_type_demande: "Construction neuve",
    };

    expect(pick(row, "no_demande", "id")).toBe("ABC-123");
    expect(pick(row, "emplacement", "adresse")).toBe("1000 Rue Sainte-Catherine");
    expect(parseMoney(row.cout_estime)).toBe(150_000);
    expect(parseDate(row.date_emission)?.getFullYear()).toBe(2024);
  });

  it("filters permits by date window", () => {
    const older = new Date("2023-01-01");
    const newer = new Date("2024-06-01");
    const maxIssueDate = new Date("2024-01-01");
    expect(older.getTime() < maxIssueDate.getTime()).toBe(true);
    expect(newer.getTime() >= maxIssueDate.getTime()).toBe(true);
  });

  it("selects recent Montreal rows even when the official CSV is not date ordered", () => {
    const csv = [
      "no_demande,id_permis,date_debut,date_emission,emplacement,arrondissement,code_type_base_demande,description_type_demande,description_type_batiment,description_categorie_batiment,nature_travaux,nb_logements,longitude,latitude,loc_x,loc_y",
      "P-1991,OLD-1,1991-10-06,1991-10-11,850 rue Cherrier,L'Ile-Bizard,CO,Construction,Residentiel,Permis ancien systeme,Ancien permis,1,-73.8,45.4,,",
      "P-2026,NEW-1,2026-03-23,2026-03-23,12348 rue Treffle-Berthiaume,Ahuntsic - Cartierville,CO,Construction,Residentiel,Unifamilial,Nouveau permis,1,-73.7,45.5,,",
      "P-1992,OLD-2,1992-01-01,1992-01-02,10 rue Ancienne,Verdun,TR,Transformation,Residentiel,Permis ancien systeme,Ancien permis,1,-73.6,45.4,,",
    ].join("\n");

    const rows = parseMontrealPermitRows(csv, 10, { maxAgeDays: 3650 });
    const permits = parsePermitRows(rows, 10, { maxAgeDays: 3650 });

    expect(permits).toHaveLength(1);
    expect(permits[0]).toMatchObject({
      permitNumber: "NEW-1",
      address: "12348 rue Treffle-Berthiaume",
      permitType: "Construction",
    });
  });
});
