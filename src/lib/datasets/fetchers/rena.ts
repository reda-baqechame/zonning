import { fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvText, pick } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type RenaRecord = {
  externalId: string;
  neq?: string;
  name?: string;
  status?: string;
  offence?: string;
  startDate?: Date;
  endDate?: Date;
  sourceUrl: string;
};

export async function fetchRena(opts: { limit?: number } = {}): Promise<RenaRecord[]> {
  const cfg = DATASETS.rena;
  const limit = opts.limit ?? getSyncLimit("rena");
  try {
    const url = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
    if (!url) return [];
    const text = await fetchText(url);
    if (!text) return [];
    const { rows } = parseCsvText(text, limit);
    return rows
      .map((row, i) => {
        const neq = pick(row, "neq", "NEQ", "numero_entreprise");
        return {
          externalId: neq || `rena-${i}`,
          neq: neq || undefined,
          name: pick(row, "nom", "name", "raison_sociale") || undefined,
          status: pick(row, "statut", "status") || undefined,
          offence: pick(row, "infraction", "offence") || undefined,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
