import { DATASETS, getSyncLimit } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";
import type { Pum2050ZoningRecord } from "./pum2050-zoning";

export async function fetchZoningTroisRivieres(
  limit?: number
): Promise<Pum2050ZoningRecord[]> {
  const cap = limit ?? getSyncLimit("zoning-trois-rivieres");
  const cfg = DATASETS["zoning-trois-rivieres"];
  const features = await fetchDatasetGeoJson("zoning-trois-rivieres", cap);

  return mapGeoFeatures(
    features,
    (props, lat, lng, i) => ({
      externalId: `v3r-zoning-${pickProp(props, "id", "objectid", "zone") || i}`,
      city: "Trois-Rivières",
      borough: pickProp(props, "secteur", "quartier") || undefined,
      latitude: lat,
      longitude: lng,
      landUse: pickProp(props, "affectation", "usage", "zone") || undefined,
      zoneCode: pickProp(props, "code_zone", "zone", "zonage") || undefined,
      description: pickProp(props, "description", "zone") || "Zonage V3R",
      sourceUrl: cfg.sourceUrl,
    }),
    cap
  );
}
