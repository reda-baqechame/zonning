import { fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvText, pick } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type InjuryRow = {
  externalId: string;
  employerName?: string;
  neq?: string;
  claimCount: number;
  year?: number;
  sourceUrl: string;
};

export async function fetchInjuries(opts: { limit?: number } = {}): Promise<InjuryRow[]> {
  const cfg = DATASETS.injuries;
  const limit = opts.limit ?? getSyncLimit("injuries");
  try {
    const url = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
    if (!url) return [];
    const text = await fetchText(url);
    if (!text) return [];
    const { rows } = parseCsvText(text, limit);
    return rows
      .map((row, i) => {
        const neq = pick(row, "neq", "NEQ");
        const cnt = Number(pick(row, "nombre", "count", "claims") || "0");
        return {
          externalId: `${neq || "inj"}-${pick(row, "annee", "year") || i}`,
          employerName: pick(row, "employeur", "nom", "employer") || undefined,
          neq: neq || undefined,
          claimCount: Number.isFinite(cnt) ? cnt : 0,
          year: Number(pick(row, "annee", "year") || "0") || undefined,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.employerName || r.neq);
  } catch {
    return [];
  }
}
