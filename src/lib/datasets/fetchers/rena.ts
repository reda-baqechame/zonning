import { fetchCkanResourceUrl, fetchText } from "../client";
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

function parseRenaXml(text: string, limit: number): RenaRecord[] {
  const cfg = DATASETS.rena;
  const results: RenaRecord[] = [];
  const blocks = text.match(/<inscription>[\s\S]*?<\/inscription>/gi) ?? [];

  for (const block of blocks) {
    if (results.length >= limit) break;
    const tag = (name: string) => {
      const m = new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i").exec(block);
      return m?.[1]?.trim() || undefined;
    };
    const neq = tag("NEQ");
    const name = tag("Nom_entreprise");
    if (!neq && !name) continue;
    const startRaw = tag("Inscription_registre");
    const endRaw = tag("Fin_inadmissibilite");
    results.push({
      externalId: neq || `rena-${results.length}`,
      neq,
      name,
      status: "non_admissible",
      offence: tag("Infraction"),
      startDate: startRaw ? new Date(startRaw) : undefined,
      endDate: endRaw ? new Date(endRaw) : undefined,
      sourceUrl: cfg.sourceUrl,
    });
  }

  return results;
}

export async function fetchRena(opts: { limit?: number } = {}): Promise<RenaRecord[]> {
  const cfg = DATASETS.rena;
  const limit = opts.limit ?? getSyncLimit("rena");
  try {
    const url = await fetchCkanResourceUrl(cfg.ckanId, ["XML", "CSV"]);
    if (!url) return [];
    const text = await fetchText(url, 20_000_000);
    if (!text) return [];
    if (text.trimStart().startsWith("<?xml") || text.includes("<inscription>")) {
      return parseRenaXml(text, limit);
    }
    return [];
  } catch {
    return [];
  }
}
