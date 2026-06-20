import { DATASETS, getSyncLimit } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";
import { buildZoningExternalId } from "@/lib/zoning/record-quality";

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
    (props, lat, lng) => {
      const borough = pickProp(props, "arrondissement", "borough", "nom_arrondissement");
      const landUse = pickProp(
        props,
        "affectation",
        "affectatio",
        "affectation_sol",
        "landuse",
      );
      const intensification = pickProp(
        props,
        "niv_txt",
        "niveau_intensification",
        "niveauint",
        "intensification",
        "niv_intensification",
      );
      const densityStr = pickProp(props, "densite", "seuil_densite", "densite_nette");
      const densityThreshold = densityStr
        ? Number(densityStr.replace(/\s/g, "").replace(",", "."))
        : undefined;
      const record = {
        city: "Montréal",
        latitude: lat,
        longitude: lng,
        landUse: landUse || undefined,
        intensificationLevel: intensification || undefined,
        densityThreshold:
          Number.isFinite(densityThreshold) && densityThreshold! > 0
            ? densityThreshold
            : undefined,
        zoneCode: pickProp(props, "code_zone", "zone") || undefined,
        sourceUrl: cfg.sourceUrl,
      };
      const externalId = buildZoningExternalId(
        "pum2050-zoning",
        pickProp(props, "objectid", "id", "fid", "uuid"),
        record,
      );
      if (!externalId) return null;

      return {
        externalId,
        ...record,
        borough: borough || undefined,
        description: landUse
          ? `PUM 2050 — ${landUse}${intensification ? ` (${intensification})` : ""}`
          : "PUM 2050",
      };
    },
    cap
  );
}
