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
        const name =
          pick(row, "contrevenant", "nom", "name", "entreprise", "personne_morale") ||
          undefined;
        const externalId =
          pick(row, "no_sanction", "no_seq", "id") || `con-${name?.slice(0, 20) ?? i}`;
        return {
          externalId,
          neq: pick(row, "neq", "NEQ") || undefined,
          name,
          offence:
            pick(row, "nature_manquement", "infraction", "offence", "description") || undefined,
          date: parseDate(pick(row, "date_imposition", "date_condamnation", "date")),
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.name || r.offence);
  } catch {
    return [];
  }
}
