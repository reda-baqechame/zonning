import { fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvText, pick, parseMoney, parseDate } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type SanctionRow = {
  externalId: string;
  neq?: string;
  name?: string;
  law?: string;
  amount?: number;
  date?: Date;
  sourceUrl: string;
};

export async function fetchSanctions(opts: { limit?: number } = {}): Promise<SanctionRow[]> {
  const cfg = DATASETS.sanctions;
  const limit = opts.limit ?? getSyncLimit("sanctions");
  try {
    const url = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
    if (!url) return [];
    const text = await fetchText(url);
    if (!text) return [];
    const { rows } = parseCsvText(text, limit);
    return rows
      .map((row, i) => {
        const neq = pick(row, "neq", "NEQ");
        return {
          externalId: neq || `san-${i}`,
          neq: neq || undefined,
          name: pick(row, "nom", "name") || undefined,
          law: pick(row, "loi", "law") || undefined,
          amount: parseMoney(pick(row, "montant", "amount")),
          date: parseDate(pick(row, "date")),
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
