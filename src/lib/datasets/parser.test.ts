import { describe, expect, it } from "vitest";
import { parseCsvLine, parseCsvText, parseCsvTextTail, parseDate, parseMoney } from "./parser";

describe("government dataset parsing", () => {
  it("handles escaped quotes and does not treat semicolons as comma delimiters", () => {
    expect(parseCsvLine('"12, rue Test";"Travaux ""majeurs"""', ";")).toEqual([
      "12, rue Test",
      'Travaux "majeurs"',
    ]);
    expect(parseCsvLine('P-1,"Réfection; agrandissement"', ",")).toEqual([
      "P-1",
      "Réfection; agrandissement",
    ]);
  });

  it("keeps a quoted multiline field in one row", () => {
    const result = parseCsvText('id,description\nP-1,"Ligne un\nLigne deux"\nP-2,Simple');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].description).toBe("Ligne un\nLigne deux");
  });

  it("detects a semicolon dataset even when a quoted header contains a comma", () => {
    const result = parseCsvText('"adresse, complète";type\n"10 rue Test";Rénovation');
    expect(result.headers).toEqual(["adresse, complète", "type"]);
    expect(result.rows[0].type).toBe("Rénovation");
  });

  it("keeps the newest records from an ascending large CSV", () => {
    const result = parseCsvTextTail(
      'id,description\n1,old\n2,"middle\nline"\n3,newer\n4,newest',
      2,
    );
    expect(result.rows).toEqual([
      { id: "3", description: "newer" },
      { id: "4", description: "newest" },
    ]);
  });

  it.each([
    ["1 234,56 $", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234,56", 1234.56],
    ["150,000", 150000],
  ])("parses Quebec money %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it("parses explicit Quebec dates and rejects ambiguous or invalid dates", () => {
    expect(parseDate("31/05/2026")?.toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(parseDate("2026-05-31")?.toISOString()).toBe("2026-05-31T00:00:00.000Z");
    expect(parseDate("05/31/2026")).toBeUndefined();
    expect(parseDate("2026-02-31")).toBeUndefined();
  });
});
