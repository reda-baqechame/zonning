import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import {
  parseCsvText,
  pick,
  parseMoney,
  parseDate,
  parseFloatSafe,
} from "../parser";
import type { PermitRecord } from "./permits";

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

function parsePermitRows(
  datasetId: CityPermitDatasetId,
  rows: Record<string, string>[],
  cap: number,
  options?: FetchCityPermitOptions
): PermitRecord[] {
  const cfg = DATASETS[datasetId];
  const maxAgeDays = options?.maxAgeDays ?? 365;
  const minDate = options?.minIssueDate;
  const cutoff = minDate
    ? minDate.getTime()
    : Date.now() - maxAgeDays * 86400000;

  const parsed: PermitRecord[] = [];

  for (const row of rows) {
    const lat = parseFloatSafe(pick(row, "latitude", "lat", "y", "LATITUDE"));
    const lng = parseFloatSafe(pick(row, "longitude", "long", "x", "lon", "LONGITUDE"));
    const externalId =
      pick(
        row,
        "no_demande",
        "id_permis",
        "numero",
        "numero_permis",
        "NUMERO_PERMIS",
        "no_permis",
        "id"
      ) || `${datasetId}-${parsed.length}`;

    const address =
      pick(row, "emplacement", "adresse", "adresse_travaux", "ADRESSE", "adresse_complete") ||
      `${pick(row, "no_civique", "nocivique")} ${pick(row, "nom_rue", "rue")}`.trim() ||
      (cfg.city ?? "Québec");

    parsed.push({
      externalId: `${datasetId}-${externalId}`,
      permitNumber: pick(row, "id_permis", "numero_permis", "NUMERO_PERMIS"),
      permitType:
        pick(
          row,
          "type_travaux",
          "nature_travaux",
          "type",
          "description",
          "TYPE_PERMIS",
          "description_type_demande"
        ) || "Construction",
      workType: pick(row, "nature_travaux", "description", "DESCRIPTION"),
      borough: pick(row, "arrondissement", "secteur", "quartier", "ARRONDISSEMENT"),
      address,
      latitude: lat,
      longitude: lng,
      estimatedCost: parseMoney(
        pick(row, "cout_estime", "cout", "montant", "COUT_ESTIME", "valeur_travaux")
      ),
      issueDate: parseDate(
        pick(
          row,
          "date_emission",
          "date_delivrance",
          "date_permis",
          "DATE_DELIVRANCE",
          "date"
        )
      ),
      applicantName: pick(
        row,
        "demandeur",
        "entrepreneur",
        "nom_demandeur",
        "ENTREPRENEUR",
        "nom_entrepreneur"
      ),
      sourceUrl: cfg.sourceUrl,
      city: cfg.city,
    });
  }

  return parsed
    .filter((p) => {
      if (!p.issueDate) return true;
      const t = p.issueDate.getTime();
      if (t < cutoff) return false;
      if (options?.maxIssueDate && t >= options.maxIssueDate.getTime()) return false;
      return true;
    })
    .sort((a, b) => (b.issueDate?.getTime() ?? 0) - (a.issueDate?.getTime() ?? 0))
    .slice(0, cap);
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

  const text = await fetchText(resourceUrl, 25_000_000);
  if (!text) {
    throw new Error(`Failed to fetch permit CSV for ${datasetId}`);
  }

  const { rows } = parseCsvText(text, cap * 2);
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
