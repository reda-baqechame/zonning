import { describe, it, expect } from "vitest";
import {
  pointInRing,
  pointInPolygon,
  pointInGeometry,
  pointInGeoJson,
  geometryBBox,
  bboxContains,
  squarePolygon,
  type Ring,
  type GeoJsonGeometry,
} from "@/lib/zoning/geometry";

// Unit square in [lng, lat] from (0,0) to (1,1).
const square: Ring = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0, 0],
];

describe("pointInRing / pointInPolygon", () => {
  it("detects inside vs outside", () => {
    expect(pointInRing([0.5, 0.5], square)).toBe(true);
    expect(pointInRing([1.5, 0.5], square)).toBe(false);
  });

  it("excludes points inside a hole", () => {
    const hole: Ring = [
      [0.4, 0.4],
      [0.6, 0.4],
      [0.6, 0.6],
      [0.4, 0.6],
      [0.4, 0.4],
    ];
    expect(pointInPolygon([0.5, 0.5], [square, hole])).toBe(false);
    expect(pointInPolygon([0.1, 0.1], [square, hole])).toBe(true);
  });
});

describe("pointInGeometry (Polygon + MultiPolygon)", () => {
  it("handles MultiPolygon membership", () => {
    const geom: GeoJsonGeometry = {
      type: "MultiPolygon",
      coordinates: [[square], [[[5, 5], [6, 5], [6, 6], [5, 6], [5, 5]]]],
    };
    expect(pointInGeometry(0.5, 0.5, geom)).toBe(true); // lat,lng
    expect(pointInGeometry(5.5, 5.5, geom)).toBe(true);
    expect(pointInGeometry(3, 3, geom)).toBe(false);
  });

  it("returns false for malformed GeoJSON instead of throwing", () => {
    expect(pointInGeoJson(0.5, 0.5, "not json")).toBe(false);
  });
});

describe("bbox helpers", () => {
  it("computes a bbox and tests containment", () => {
    const geom = squarePolygon(45.5, -73.5, 0.01);
    const bbox = geometryBBox(geom);
    expect(bbox.minLat).toBeCloseTo(45.49, 5);
    expect(bbox.maxLat).toBeCloseTo(45.51, 5);
    expect(bboxContains(bbox, 45.5, -73.5)).toBe(true);
    expect(bboxContains(bbox, 46, -73.5)).toBe(false);
  });

  it("squarePolygon contains its own centre", () => {
    const geom = squarePolygon(45.5, -73.5, 0.003);
    expect(pointInGeometry(45.5, -73.5, geom)).toBe(true);
  });
});
