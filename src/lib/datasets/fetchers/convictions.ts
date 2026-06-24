import { fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvText, pick, parseDate } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type ConvictionRow = {
  externalId: string;
  neq?: string;
  name?: string;
  offence?: string;
  date?: Date;
  sourceUrl: string;
};

export async function fetchConvictions(opts: { limit?: number } = {}): Promise<ConvictionRow[]> {
  const cfg = DATASETS.convictions;
  const limit = opts.limit ?? getSyncLimit("convictions");
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
          externalId: neq || `con-${i}`,
          neq: neq || undefined,
          name: pick(row, "nom", "name") || undefined,
          offence: pick(row, "infraction", "offence") || undefined,
          date: parseDate(pick(row, "date")),
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
