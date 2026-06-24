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
    const text = await fetchText(url, 20_000_000);
    if (!text) return [];
    const yearMatch = /lesions-(\d{4})/i.exec(url);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;
    const { rows } = parseCsvText(text, limit);
    return rows
      .map((row) => {
        const id = pick(row, "id");
        const sector = pick(row, "secteur_scian", "employeur", "nom", "employer");
        return {
          externalId: id || `inj-${sector}-${pick(row, "nature_lesion")}`,
          employerName: sector || undefined,
          claimCount: 1,
          year,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.employerName);
  } catch {
    return [];
  }
}
