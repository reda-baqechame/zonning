import { describe, expect, it } from "vitest";

/** Mirrors GTC ArcGIS attribute mapping in contamination-gtc.ts */
function mapGtcAttrs(attrs: Record<string, unknown>, index: number) {
  const lat = Number(attrs.LATITUDE ?? attrs.latitude);
  const lng = Number(attrs.LONGITUDE ?? attrs.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const siteId = String(attrs.NO_MEF_LIEU ?? attrs.OBJECTID ?? index);
  return {
    externalId: `gtc-${siteId}`,
    address: String(attrs.ADR_CIV_LIEU ?? "").trim() || undefined,
    latitude: lat,
    longitude: lng,
    region: String(attrs.LST_MRC_REG_ADM ?? "").split(",")[0]?.trim() || undefined,
    sourceLayer: "gtc" as const,
  };
}

describe("GTC ArcGIS attribute mapping", () => {
  it("maps MELCC point attributes to contamination records", () => {
    const row = mapGtcAttrs(
      {
        NO_MEF_LIEU: "12345678",
        ADR_CIV_LIEU: "100 rue Principale",
        LATITUDE: 46.8,
        LONGITUDE: -71.2,
        LST_MRC_REG_ADM: "Québec, Capitale-Nationale",
      },
      0
    );
    expect(row?.externalId).toBe("gtc-12345678");
    expect(row?.latitude).toBe(46.8);
    expect(row?.region).toBe("Québec");
    expect(row?.sourceLayer).toBe("gtc");
  });

  it("returns null without coordinates", () => {
    expect(mapGtcAttrs({ NO_MEF_LIEU: "x" }, 0)).toBeNull();
  });
});
