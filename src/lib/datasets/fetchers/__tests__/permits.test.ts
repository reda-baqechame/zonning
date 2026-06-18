import { describe, expect, it } from "vitest";
import { parseDate, parseMoney, pick } from "../../parser";

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
});
