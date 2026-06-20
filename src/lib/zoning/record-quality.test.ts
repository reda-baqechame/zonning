import { describe, expect, it } from "vitest";
import { buildZoningExternalId, isUsableZoningRecord } from "./record-quality";

const base = {
  city: "Montréal",
  latitude: 45.5,
  longitude: -73.57,
  densityThreshold: 180,
  sourceUrl: "https://donnees.montreal.ca/dataset/pum-2050",
};

describe("zoning record quality", () => {
  it("rejects geometry-only rows with no zoning evidence", () => {
    expect(
      isUsableZoningRecord({
        ...base,
        densityThreshold: undefined,
      }),
    ).toBe(false);
  });

  it("derives a stable identity from evidence instead of row position", () => {
    expect(buildZoningExternalId("pum2050-zoning", null, base)).toBe(
      buildZoningExternalId("pum2050-zoning", null, base),
    );
  });

  it("namespaces official source identifiers by dataset", () => {
    expect(buildZoningExternalId("pum2050-zoning", "42", base)).toBe(
      "pum2050-zoning:42",
    );
  });
});
