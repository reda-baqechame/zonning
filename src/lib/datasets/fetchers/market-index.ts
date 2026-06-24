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
        const cnt = Number(pick(row, "nombre", "ventes", "sales") || "0");
        const di = Number(pick(row, "indice", "difficulty", "indice_difficulte") || "NaN");
        return {
          externalId: `${pick(row, "region") || "reg"}-${pick(row, "periode", "period") || i}`,
          region: pick(row, "region") || undefined,
          priceRange: pick(row, "tranche_prix", "price_range") || undefined,
          salesCount: Number.isFinite(cnt) ? cnt : 0,
          difficultyIndex: Number.isFinite(di) ? di : undefined,
          period: pick(row, "periode", "period") || undefined,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.region || r.period);
  } catch {
    return [];
  }
}
