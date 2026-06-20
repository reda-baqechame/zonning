import { describe, expect, it } from "vitest";
import { centroidFromGeometry, parseGeoJsonCentroids, haversineKm } from "../geo";
import { reprojectGeoJsonFeatures } from "../geo-fetch";

const PUM2050_FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-73.57, 45.5],
            [-73.56, 45.5],
            [-73.56, 45.51],
            [-73.57, 45.51],
            [-73.57, 45.5],
          ],
        ],
      },
      properties: { ARRONDISSEMENT: "Ville-Marie", NIVEAU_INT: "Élevé" },
    },
  ],
};

const GTC_FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-71.2, 46.8] },
      properties: { NOM_SITE: "Site test GTC", REGION: "Capitale-Nationale" },
    },
  ],
};

const LPC_FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-73.58, 45.52],
            [-73.579, 45.52],
            [-73.579, 45.521],
            [-73.58, 45.521],
            [-73.58, 45.52],
          ],
        ],
      },
      properties: { NOM: "Édifice patrimonial LPC" },
    },
  ],
};

describe("GeoJSON centroid parsing for government datasets", () => {
  it("reprojects Montreal EPSG:32188 geometry before spatial matching", () => {
    const [feature] = reprojectGeoJsonFeatures(
      [
        {
          geometry: { type: "Point", coordinates: [304800, 5_040_000] },
          properties: {},
        },
      ],
      "urn:ogc:def:crs:EPSG::32188",
    );
    const centroid = centroidFromGeometry(feature.geometry);
    expect(centroid?.longitude).toBeCloseTo(-73.5, 2);
    expect(centroid?.latitude).toBeGreaterThan(45);
    expect(centroid?.latitude).toBeLessThan(46);
  });
  it("extracts PUM 2050 polygon centroids with borough", () => {
    const rows = parseGeoJsonCentroids(
      PUM2050_FIXTURE.features,
      (props, centroid) => ({
        borough: String(props.ARRONDISSEMENT ?? ""),
        level: String(props.NIVEAU_INT ?? ""),
        ...centroid,
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].borough).toBe("Ville-Marie");
    expect(rows[0].latitude).toBeCloseTo(45.505, 2);
    expect(rows[0].longitude).toBeCloseTo(-73.565, 2);
  });

  it("extracts GTC point features", () => {
    const rows = parseGeoJsonCentroids(GTC_FIXTURE.features, (props, centroid) => ({
      name: String(props.NOM_SITE ?? ""),
      region: String(props.REGION ?? ""),
      ...centroid,
    }));
    expect(rows[0].name).toBe("Site test GTC");
    expect(rows[0].latitude).toBe(46.8);
    expect(rows[0].longitude).toBe(-71.2);
  });

  it("extracts LPC heritage polygon centroids", () => {
    const rows = parseGeoJsonCentroids(LPC_FIXTURE.features, (props, centroid) => ({
      name: String(props.NOM ?? ""),
      ...centroid,
    }));
    expect(rows[0].name).toBe("Édifice patrimonial LPC");
    expect(haversineKm(rows[0].latitude, rows[0].longitude, 45.52, -73.58)).toBeLessThan(1);
  });
});
