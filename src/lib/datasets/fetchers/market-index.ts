import { fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvText, pick } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type MarketIndexRow = {
  externalId: string;
  region?: string;
  priceRange?: string;
  salesCount: number;
  difficultyIndex?: number;
  period?: string;
  sourceUrl: string;
};

export async function fetchMarketIndex(opts: { limit?: number } = {}): Promise<MarketIndexRow[]> {
  const cfg = DATASETS["market-index"];
  const limit = opts.limit ?? getSyncLimit("market-index");
  try {
    const url = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
    if (!url) return [];
    const text = await fetchText(url);
    if (!text) return [];
    const { rows } = parseCsvText(text, limit);
    return rows
      .map((row, i) => {
        const cnt = Number(pick(row, "nb_reqst", "nombre", "ventes", "sales") || "0");
        return {
          externalId: `${pick(row, "id_regn_admin", "region") || "reg"}-${pick(row, "dt_debut_mois", "periode", "period") || i}-${pick(row, "cd_plage_prix", "tranche_prix") || "p"}`,
          region: pick(row, "id_regn_admin", "region") || undefined,
          priceRange: pick(row, "cd_plage_prix", "tranche_prix", "price_range") || undefined,
          salesCount: Number.isFinite(cnt) ? cnt : 0,
          period: pick(row, "dt_debut_mois", "periode", "period") || undefined,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.region || r.period);
  } catch {
    return [];
  }
}
