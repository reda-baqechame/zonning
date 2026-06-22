import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import {
  parseCsvLine,
  parseCsvText,
  pick,
  parseMoney,
  parseDate,
  parseFloatSafe,
} from "../parser";
import type { PermitRecord } from "./permits";
import { assessPermitQuality, buildPermitExternalId } from "@/lib/permits/quality";

export type CityPermitDatasetId =
  | "permits-laval"
  | "permits-longueuil"
  | "permits-quebec"
  | "permits-gatineau"
  | "permits-levis";

export type FetchCityPermitOptions = {
  maxAgeDays?: number;
  minIssueDate?: Date;
  maxIssueDate?: Date;
};

function resolveCkanId(datasetId: CityPermitDatasetId): string {
  if (datasetId === "permits-gatineau") {
    return process.env.GATINEAU_PERMITS_CKAN_ID ?? "permis-de-construction-ville-de-gatineau";
  }
  return DATASETS[datasetId].ckanId;
}

export function parsePermitRows(
  datasetId: CityPermitDatasetId,
  rows: Record<string, string>[],
  cap: number,
  options?: FetchCityPermitOptions,
): PermitRecord[] {
  const cfg = DATASETS[datasetId];
  const maxAgeDays = options?.maxAgeDays ?? 365;
  const cutoff = options?.minIssueDate
    ? options.minIssueDate.getTime()
    : Date.now() - maxAgeDays * 86400000;
  const parsed = new Map<string, { permit: PermitRecord; qualityScore: number }>();

  for (const row of rows) {
    const address =
      pick(row, "emplacement", "adresse", "adresse_travaux", "ADRESSE", "adresse_complete") ||
      `${pick(row, "no_civique", "nocivique")} ${pick(row, "nom_rue", "rue")}`.trim();
    const permitType = pick(
      row,
      "type_travaux",
      "nature_travaux",
      "type",
      "description",
      "type_permis_descr",
      "TYPE_PERMIS",
      "description_type_demande",
    );
    const issueDate = parseDate(
      pick(
        row,
        "date_emission",
        "date_delivrance",
        "date_permis",
        "DATE_DELIVRANCE",
        "date",
      ),
    );
    if (!issueDate) continue;

    const issueTime = issueDate.getTime();
    if (issueTime < cutoff) continue;
    if (options?.maxIssueDate && issueTime >= options.maxIssueDate.getTime()) continue;

    const sourceId = pick(
      row,
      "no_demande",
      "id_permis",
      "numero",
      "numero_permis",
      "NUMERO_PERMIS",
      "no_permis",
      "id",
    );
    const rawExternalId = buildPermitExternalId(datasetId, sourceId, {
      address,
      permitType,
      issueDate,
      city: cfg.city,
    });
    if (!rawExternalId) continue;
    const externalId = rawExternalId.startsWith("derived:")
      ? rawExternalId
      : `${datasetId}-${rawExternalId}`;

    const permit: PermitRecord = {
      externalId,
      permitNumber: pick(row, "id_permis", "numero_permis", "NUMERO_PERMIS", "no_permis") || undefined,
      permitType,
      workType: pick(row, "nature_travaux", "description", "DESCRIPTION") || undefined,
      borough: pick(row, "arrondissement", "secteur", "quartier", "ARRONDISSEMENT") || undefined,
      address,
      latitude: parseFloatSafe(pick(row, "latitude", "lat", "y", "LATITUDE")),
      longitude: parseFloatSafe(pick(row, "longitude", "long", "x", "lon", "LONGITUDE")),
      estimatedCost: parseMoney(
        pick(row, "cout_estime", "cout", "montant", "COUT_ESTIME", "valeur_travaux", "cout_permis"),
      ),
      issueDate,
      applicantName:
        pick(
          row,
          "demandeur",
          "entrepreneur",
          "nom_demandeur",
          "ENTREPRENEUR",
          "nom_entrepreneur",
        ) || undefined,
      sourceUrl: cfg.sourceUrl,
      city: cfg.city,
    };
    const quality = assessPermitQuality(permit);
    if (!quality.usable) continue;

    const existing = parsed.get(externalId);
    if (!existing || quality.score > existing.qualityScore) {
      parsed.set(externalId, { permit, qualityScore: quality.score });
    }
  }

  return [...parsed.values()]
    .map(({ permit }) => permit)
    .sort((a, b) => (b.issueDate?.getTime() ?? 0) - (a.issueDate?.getTime() ?? 0))
    .slice(0, cap);
}

export function parseLavalPermitRows(
  text: string,
  cap: number,
  options?: FetchCityPermitOptions,
): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const delimiter = parseCsvLine(headerLine, ";").length > parseCsvLine(headerLine, ",").length
    ? ";"
    : ",";
  const headers = parseCsvLine(headerLine, delimiter).map((value) =>
    value.replace(/^\uFEFF/, "").toLowerCase().trim(),
  );
  const dateIndex = headers.indexOf("date_emission");
  if (dateIndex < 0) return [];

  const maxAgeDays = options?.maxAgeDays ?? 365;
  const cutoff = options?.minIssueDate
    ? options.minIssueDate.getTime()
    : Date.now() - maxAgeDays * 86400000;
  const maxIssueTime = options?.maxIssueDate?.getTime();
  const candidates: Array<{ row: Record<string, string>; issueTime: number }> = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const issueDate = parseDate(cols[dateIndex] ?? "");
    if (!issueDate) continue;

    const issueTime = issueDate.getTime();
    if (issueTime < cutoff) continue;
    if (maxIssueTime && issueTime >= maxIssueTime) continue;

    const row: Record<string, string> = {};
    headers.forEach((key, index) => {
      row[key] = cols[index]?.trim() ?? "";
    });
    candidates.push({ row, issueTime });
  }

  return candidates
    .sort((a, b) => b.issueTime - a.issueTime)
    .slice(0, Math.max(cap * 4, cap))
    .map(({ row }) => row);
}

async function fetchCityPermitsFromCkan(
  datasetId: CityPermitDatasetId,
  limit?: number,
  options?: FetchCityPermitOptions
): Promise<PermitRecord[]> {
  const cfg = DATASETS[datasetId];
  const cap = limit ?? getSyncLimit(datasetId);

  const ckanId = resolveCkanId(datasetId);
  const resourceUrl = await fetchCkanResourceUrl(ckanId, cfg.preferredFormat);
  if (!resourceUrl) {
    throw new Error(`CKAN resource URL not found for ${datasetId}`);
  }

  const text = await fetchText(resourceUrl, datasetId === "permits-laval" ? 60_000_000 : 25_000_000);
  if (!text) {
    throw new Error(`Failed to fetch permit CSV for ${datasetId}`);
  }

  const { rows } = datasetId === "permits-laval"
    ? { rows: parseLavalPermitRows(text, cap, options) }
    : parseCsvText(text, cap * 2);
  return parsePermitRows(datasetId, rows, cap, options);
}

/** Optional city-hosted CSV when Données Québec CKAN is not yet published. */
async function fetchGatineauFromStatsUrl(
  url: string,
  limit?: number,
  options?: FetchCityPermitOptions
): Promise<PermitRecord[]> {
  const cap = limit ?? getSyncLimit("permits-gatineau");
  const text = await fetchText(url, 25_000_000);
  if (!text) return [];
  const { rows } = parseCsvText(text, cap * 2);
  return parsePermitRows("permits-gatineau", rows, cap, options);
}

export async function fetchCityPermits(
  datasetId: CityPermitDatasetId,
  limit?: number,
  options?: FetchCityPermitOptions
): Promise<PermitRecord[]> {
  if (datasetId === "permits-gatineau") {
    try {
      return await fetchCityPermitsFromCkan(datasetId, limit, options);
    } catch (e) {
      const statsUrl = process.env.GATINEAU_PERMITS_STATS_URL;
      if (statsUrl) {
        const fromStats = await fetchGatineauFromStatsUrl(statsUrl, limit, options);
        if (fromStats.length > 0) return fromStats;
      }
      const msg = e instanceof Error ? e.message : "fetch failed";
      console.warn(
        `[permits-gatineau] ${msg} — awaiting Données Québec CKAN; set GATINEAU_PERMITS_CKAN_ID or GATINEAU_PERMITS_STATS_URL`
      );
      return [];
    }
  }

  if (datasetId === "permits-longueuil") {
    try {
      return await fetchCityPermitsFromCkan(datasetId, limit, options);
    } catch (e) {
      const directUrl = process.env.LONGUEUIL_PERMITS_URL;
      if (directUrl) {
        const cap = limit ?? getSyncLimit(datasetId);
        const text = await fetchText(directUrl, 25_000_000);
        if (text) {
          const { rows } = parseCsvText(text, cap * 2);
          const parsed = parsePermitRows(datasetId, rows, cap, options);
          if (parsed.length > 0) return parsed;
        }
      }
      const msg = e instanceof Error ? e.message : "fetch failed";
      console.warn(
        `[permits-longueuil] ${msg} — no public CKAN yet; set LONGUEUIL_PERMITS_URL when available`
      );
      return [];
    }
  }

  return fetchCityPermitsFromCkan(datasetId, limit, options);
}

/** Lévis — direct CSV when `LEVIS_PERMITS_URL` is configured (no open CKAN yet). */
export async function fetchLevisPermits(
  limit?: number,
  options?: FetchCityPermitOptions
): Promise<PermitRecord[]> {
  const url = process.env.LEVIS_PERMITS_URL;
  if (!url) return [];

  const cap = limit ?? getSyncLimit("permits-levis");
  const text = await fetchText(url, 25_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap * 2);
  return parsePermitRows("permits-levis", rows, cap, options);
}

export async function fetchSherbrookePermits(
  limit?: number,
  options?: { minIssueDate?: Date }
): Promise<PermitRecord[]> {
  const { fetchEnvScaffoldPermits } = await import("./regulatory-scaffold");
  const remote = await fetchEnvScaffoldPermits("permits-sherbrooke", options);
  return remote.slice(0, limit ?? getSyncLimit("permits-sherbrooke")) as PermitRecord[];
}

export async function fetchTroisRivieresPermits(
  limit?: number,
  options?: { minIssueDate?: Date }
): Promise<PermitRecord[]> {
  const { fetchEnvScaffoldPermits } = await import("./regulatory-scaffold");
  const remote = await fetchEnvScaffoldPermits("permits-trois-rivieres", options);
  return remote.slice(0, limit ?? getSyncLimit("permits-trois-rivieres")) as PermitRecord[];
}

export async function fetchSaguenayPermits(
  limit?: number,
  options?: { minIssueDate?: Date }
): Promise<PermitRecord[]> {
  const { fetchEnvScaffoldPermits } = await import("./regulatory-scaffold");
  const remote = await fetchEnvScaffoldPermits("permits-saguenay", options);
  return remote.slice(0, limit ?? getSyncLimit("permits-saguenay")) as PermitRecord[];
}

export async function fetchEnvCityPermits(
  datasetId:
    | "permits-terrebonne"
    | "permits-repentigny"
    | "permits-brossard"
    | "permits-saint-jean-richelieu"
    | "permits-drummondville"
    | "permits-saint-jerome"
    | "permits-granby"
    | "permits-saint-hyacinthe",
  limit?: number,
  options?: { minIssueDate?: Date }
): Promise<PermitRecord[]> {
  const { fetchEnvScaffoldPermits } = await import("./regulatory-scaffold");
  const remote = await fetchEnvScaffoldPermits(datasetId, options);
  return remote.slice(0, limit ?? getSyncLimit(datasetId)) as PermitRecord[];
}

export async function fetchCityPermitsPaginated(
  datasetId: CityPermitDatasetId,
  totalCap?: number,
  options?: FetchCityPermitOptions
): Promise<PermitRecord[]> {
  const cap = totalCap ?? getSyncLimit(datasetId);
  if (options?.minIssueDate) {
    return fetchCityPermits(datasetId, cap, options);
  }

  const all: PermitRecord[] = [];
  const seen = new Set<string>();
  const windowSize = Math.min(3000, cap);
  let maxIssueDate: Date | undefined;

  for (let pass = 0; pass < 15 && all.length < cap; pass++) {
    const batch = await fetchCityPermits(datasetId, windowSize, { ...options, maxIssueDate });
    if (batch.length === 0) break;

    for (const p of batch) {
      if (!seen.has(p.externalId)) {
        seen.add(p.externalId);
        all.push(p);
      }
    }

    const oldest = batch[batch.length - 1]?.issueDate;
    if (!oldest || batch.length < 30) break;
    maxIssueDate = oldest;
  }

  return all.slice(0, cap);
}
