import { fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvText, pick, parseDate } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type EnterpriseRow = {
  externalId: string;
  neq?: string;
  name?: string;
  legalStatus?: string;
  constitutionDate?: Date;
  address?: string;
  sourceUrl: string;
};

export async function fetchRegistreEntreprises(
  opts: { limit?: number } = {},
): Promise<EnterpriseRow[]> {
  const cfg = DATASETS["registre-entreprises"];
  const limit = opts.limit ?? getSyncLimit("registre-entreprises");
  try {
    const url = await fetchCkanResourceUrl(cfg.ckanId, cfg.preferredFormat);
    if (!url) return [];
    const text = await fetchText(url, 20_000_000);
    if (!text) return [];
    const { rows } = parseCsvText(text, limit);
    return rows
      .map((row, i) => {
        const neq = pick(row, "neq", "NEQ", "numero_entreprise");
        return {
          externalId: neq || `ent-${i}`,
          neq: neq || undefined,
          name: pick(row, "nom", "raison_sociale", "name") || undefined,
          legalStatus: pick(row, "statut", "statut_juridique") || undefined,
          constitutionDate: parseDate(pick(row, "date_constitution", "constitution")),
          address: pick(row, "adresse", "address") || undefined,
          sourceUrl: cfg.sourceUrl,
        };
      })
      .filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
