import { describe, it, expect } from "vitest";
import { centroidFromGeometry, parseGeoJsonCentroids } from "../geo";

describe("geo centroids", () => {
  it("extracts point geometry", () => {
    const c = centroidFromGeometry({
      type: "Point",
      coordinates: [-73.55, 45.5],
    });
    expect(c).toEqual({ longitude: -73.55, latitude: 45.5 });
  });

  it("parses feature collection", () => {
    const results = parseGeoJsonCentroids(
      [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [-73.5, 45.5] },
          properties: { Affectation: "Résidentiel" },
        },
      ],
      (props, centroid) => ({
        landUse: String(props.Affectation),
        ...centroid,
      }),
      10
    );
    expect(results).toHaveLength(1);
    expect(results[0].landUse).toBe("Résidentiel");
  });
});
