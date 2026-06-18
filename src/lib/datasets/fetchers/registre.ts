import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvText, pick } from "../parser";

export type RegistreRecord = {
  externalId: string;
  name: string;
  neq?: string;
  city?: string;
  region?: string;
  sector?: string;
  sourceUrl: string;
};

function parseRegistreRows(rows: Record<string, string>[], cap: number): RegistreRecord[] {
  const results: RegistreRecord[] = [];
  const seenNeq = new Set<string>();

  for (const row of rows) {
    const neq = pick(row, "neq", "numero_neq", "no_neq", "numeroentreprise");
    if (neq && seenNeq.has(neq)) continue;
    if (neq) seenNeq.add(neq);
    const name = pick(
      row,
      "nom",
      "nom_entreprise",
      "raison_sociale",
      "nom_legal",
      "denomination"
    );
    if (!name) continue;

    const externalId = neq || `registre-${results.length}`;
    results.push({
      externalId,
      name,
      neq: neq || undefined,
      city: pick(row, "ville", "municipalite", "city"),
      region: pick(row, "region", "province"),
      sector: pick(row, "secteur", "activite", "code_activite_economique"),
      sourceUrl: DATASETS.registre.sourceUrl,
    });
    if (results.length >= cap) break;
  }

  return results;
}

function isBinaryBulkExport(url: string): boolean {
  return /\.(zip|pdf)(\?|$)/i.test(url) || url.includes("registreentreprises.gouv.qc.ca");
}

export async function fetchRegistre(limit?: number): Promise<RegistreRecord[]> {
  const cap = limit ?? getSyncLimit("registre");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.registre.ckanId,
    DATASETS.registre.preferredFormat
  );

  if (resourceUrl && !isBinaryBulkExport(resourceUrl)) {
    const text = await fetchText(resourceUrl, 20_000_000);
    if (text) {
      const { rows } = parseCsvText(text, cap);
      const results = parseRegistreRows(rows, cap);
      if (results.length > 0) return results;
    }
  }

  const overrideUrl = process.env.REGISTRE_CSV_URL;
  if (overrideUrl) {
    const text = await fetchText(overrideUrl, 20_000_000);
    if (text) {
      const { rows } = parseCsvText(text, cap);
      const results = parseRegistreRows(rows, cap);
      if (results.length > 0) return results;
    }
  }

  try {
    const mirrorResults = await fetchRegistreFromMirror(cap);
    if (mirrorResults.length > 0) return mirrorResults;
  } catch (e) {
    console.warn("[registre]", e instanceof Error ? e.message : e);
  }

  if (resourceUrl && isBinaryBulkExport(resourceUrl)) {
    console.warn(
      "[registre] Official export is ZIP-only on registreentreprises.gouv.qc.ca — set REGISTRE_CSV_URL for a direct CSV mirror"
    );
  }

  return [];
}

async function fetchRegistreFromMirror(cap: number): Promise<RegistreRecord[]> {
  const pkg = await fetch(
    "https://www.donneesquebec.ca/recherche/api/3/action/package_search?q=registre+entreprises+csv",
    { cache: "no-store" }
  );
  if (!pkg.ok) {
    throw new Error(`Registre mirror search failed: HTTP ${pkg.status}`);
  }

  const data = (await pkg.json()) as {
    result?: { results?: { resources?: { url: string; format: string }[] }[] };
  };
  const packages = data.result?.results ?? [];
  let sawCsv = false;

  for (const p of packages) {
    const csv = p.resources?.find((r) => r.format?.toUpperCase() === "CSV");
    if (!csv?.url) continue;
    sawCsv = true;
    const text = await fetchText(csv.url, 10_000_000);
    if (!text) continue;
    const { rows } = parseCsvText(text, cap);
    const results: RegistreRecord[] = [];
    for (const row of rows) {
      const neq = pick(row, "neq", "numero_neq", "no_neq");
      const name = pick(row, "nom", "nom_entreprise", "raison_sociale");
      if (!name) continue;
      results.push({
        externalId: neq || `registre-${results.length}`,
        name,
        neq: neq || undefined,
        city: pick(row, "ville", "municipalite"),
        region: pick(row, "region") || "Québec",
        sector: pick(row, "secteur", "activite"),
        sourceUrl: DATASETS.registre.sourceUrl,
      });
      if (results.length >= cap) return results;
    }
    if (results.length > 0) return results;
  }

  if (!sawCsv) {
    throw new Error("Registre mirror: no CSV resources found");
  }

  return [];
}
