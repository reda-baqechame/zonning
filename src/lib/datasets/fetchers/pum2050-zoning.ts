import { DATASETS, getSyncLimit } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";

export type Pum2050ZoningRecord = {
  externalId: string;
  city: string;
  borough?: string;
  latitude: number;
  longitude: number;
  landUse?: string;
  intensificationLevel?: string;
  densityThreshold?: number;
  zoneCode?: string;
  description?: string;
  sourceUrl: string;
};

export async function fetchPum2050Zoning(limit?: number): Promise<Pum2050ZoningRecord[]> {
  const cap = limit ?? getSyncLimit("pum2050-zoning");
  const cfg = DATASETS["pum2050-zoning"];
  const features = await fetchDatasetGeoJson("pum2050-zoning", cap);

  return mapGeoFeatures(
    features,
    (props, lat, lng, i) => {
      const borough = pickProp(props, "arrondissement", "borough", "nom_arrondissement");
      const landUse = pickProp(props, "affectation", "affectation_sol", "landuse");
      const intensification = pickProp(
        props,
        "niveau_intensification",
        "intensification",
        "niv_intensification"
      );
      const densityStr = pickProp(props, "densite", "seuil_densite", "densite_nette");
      const densityThreshold = densityStr ? parseFloat(densityStr) : undefined;

      return {
        externalId: `pum2050-${borough || "mtl"}-${i}`,
        city: "Montréal",
        borough: borough || undefined,
        latitude: lat,
        longitude: lng,
        landUse: landUse || undefined,
        intensificationLevel: intensification || undefined,
        densityThreshold: Number.isFinite(densityThreshold) ? densityThreshold : undefined,
        zoneCode: pickProp(props, "code_zone", "zone") || undefined,
        description: landUse
          ? `PUM 2050 — ${landUse}${intensification ? ` (${intensification})` : ""}`
          : "PUM 2050",
        sourceUrl: cfg.sourceUrl,
      };
    },
    cap
  );
}
