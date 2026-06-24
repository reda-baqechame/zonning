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
      .map((row) => {
        const externalId = pick(row, "no_sanction", "no_seq", "no_sanction_gie");
        const name =
          pick(row, "entreprise", "contrevenant", "nom", "name") || undefined;
        return {
          externalId: externalId || `san-${name?.slice(0, 20) ?? "row"}`,
          name,
          law: pick(row, "loi_reglement", "loi", "law") || undefined,
          amount: parseMoney(pick(row, "amende", "montant", "amount")),
          date: parseDate(pick(row, "date_imposition", "date")),
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.name);
  } catch {
    return [];
  }
}
