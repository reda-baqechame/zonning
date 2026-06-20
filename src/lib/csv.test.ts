import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./csv";

describe("escapeCsvCell", () => {
  it("quotes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\tformula"])(
    "neutralizes spreadsheet formula %s",
    (value) => {
      expect(escapeCsvCell(value).startsWith("'")).toBe(true);
    },
  );

  it("keeps numeric negatives numeric", () => {
    expect(escapeCsvCell(-42)).toBe("-42");
  });
});
