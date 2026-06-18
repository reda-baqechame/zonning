import { DATASETS, getSyncLimit } from "../registry";
import { fetchDatasetGeoJson, mapGeoFeatures, pickProp } from "../geo-fetch";

export type LpcHeritageRecord = {
  externalId: string;
  name?: string;
  address?: string;
  borough?: string;
  latitude: number;
  longitude: number;
  category: string;
  status?: string;
  description?: string;
  sourceUrl: string;
};

export async function fetchHeritageLpc(limit?: number): Promise<LpcHeritageRecord[]> {
  const cap = limit ?? getSyncLimit("heritage-lpc");
  const cfg = DATASETS["heritage-lpc"];
  const features = await fetchDatasetGeoJson("heritage-lpc", cap);

  return mapGeoFeatures(
    features,
    (props, lat, lng, i) => {
      const id = pickProp(props, "id_lpc", "id", "objectid") || String(i);
      const name = pickProp(props, "nom", "name", "nom_immeuble");
      return {
        externalId: `heritage-lpc-${id}`,
        name: name || undefined,
        address: pickProp(props, "adresse", "address") || undefined,
        borough: pickProp(props, "arrondissement", "borough") || undefined,
        latitude: lat,
        longitude: lng,
        category: "lpc",
        status: pickProp(props, "type_zone", "zone_expl", "statut") || undefined,
        description: pickProp(props, "zone_expl", "type_zone") || undefined,
        sourceUrl: cfg.sourceUrl,
      };
    },
    cap
  );
}

export async function fetchPum2050Heritage(limit?: number): Promise<LpcHeritageRecord[]> {
  const cap = limit ?? getSyncLimit("pum2050-heritage");
  const cfg = DATASETS["pum2050-heritage"];
  const features = await fetchDatasetGeoJson("pum2050-heritage", cap);

  return mapGeoFeatures(
    features,
    (props, lat, lng, i) => {
      const name = pickProp(props, "nom", "name", "nom_immeuble", "nom_ensemble");
      return {
        externalId: `pum2050-heritage-${pickProp(props, "id", "objectid") || i}`,
        name: name || undefined,
        borough: pickProp(props, "arrondissement", "borough") || undefined,
        latitude: lat,
        longitude: lng,
        category: "pum2050",
        status: pickProp(props, "type", "categorie") || undefined,
        description: name ? `PUM 2050 patrimoine — ${name}` : "PUM 2050 patrimoine",
        sourceUrl: cfg.sourceUrl,
      };
    },
    cap
  );
}
