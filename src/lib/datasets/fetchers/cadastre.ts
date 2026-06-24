import { arcGisFeature } from "../adapters/ArcGisFeatureAdapter";
import { DATASETS, getSyncLimit } from "../registry";

export type CadastreRow = {
  externalId: string;
  lotNumber?: string;
  city?: string;
  geom?: unknown;
  sourceUrl: string;
};

export async function fetchCadastre(opts: { limit?: number } = {}): Promise<CadastreRow[]> {
  const cfg = DATASETS.cadastre;
  const limit = opts.limit ?? getSyncLimit("cadastre");
  const url = cfg.arcGisLayerUrl;
  if (!url) return [];

  try {
    return arcGisFeature.queryAll(
      url,
      (attrs, centroid, i) => {
        const lotNumber =
          String(
            attrs.NO_LOT ??
              attrs.no_lot ??
              attrs.lot ??
              attrs.LOT ??
              attrs.NUM_LOT ??
              "",
          ).trim() || undefined;
        if (!lotNumber) return null;
        return {
          externalId: String(attrs.OBJECTID ?? attrs.GlobalID ?? attrs.id ?? `lot-${i}`),
          lotNumber,
          city: String(attrs.municipalite ?? attrs.city ?? attrs.MUNICIPALITE ?? "").trim() || undefined,
          geom: { latitude: centroid.latitude, longitude: centroid.longitude },
          sourceUrl: cfg.sourceUrl,
        };
      },
      {
        outFields: "OBJECTID,GlobalID,NO_LOT",
        maxRecords: limit,
        pageSize: 500,
        returnGeometry: true,
      },
    );
  } catch {
    return [];
  }
}
