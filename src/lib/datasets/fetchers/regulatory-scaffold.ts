import { fetchText } from "../client";
import { DATASETS, getSyncLimit, type DatasetId } from "../registry";
import { parseCsvText, pick, parseDate } from "../parser";

/** Env-URL permit datasets (CKAN not live or direct CSV). */
export const ENV_PERMIT_DATASET_IDS = [
  "permits-sherbrooke",
  "permits-trois-rivieres",
  "permits-saguenay",
  "permits-terrebonne",
  "permits-repentigny",
  "permits-brossard",
  "permits-saint-jean-richelieu",
  "permits-drummondville",
  "permits-saint-jerome",
  "permits-granby",
  "permits-saint-hyacinthe",
] as const;

export type EnvPermitDatasetId = (typeof ENV_PERMIT_DATASET_IDS)[number];

const ENV_URL_KEYS: Record<EnvPermitDatasetId, string> = {
  "permits-sherbrooke": "SHERBROOKE_PERMITS_URL",
  "permits-trois-rivieres": "V3R_PERMITS_URL",
  "permits-saguenay": "SAGUENAY_PERMITS_URL",
  "permits-terrebonne": "TERREBONNE_PERMITS_URL",
  "permits-repentigny": "REPENTIGNY_PERMITS_URL",
  "permits-brossard": "BROSSARD_PERMITS_URL",
  "permits-saint-jean-richelieu": "SJR_PERMITS_URL",
  "permits-drummondville": "DRUMMONDVILLE_PERMITS_URL",
  "permits-saint-jerome": "SAINT_JEROME_PERMITS_URL",
  "permits-granby": "GRANBY_PERMITS_URL",
  "permits-saint-hyacinthe": "SAINT_HYACINTHE_PERMITS_URL",
};

export function getEnvPermitUrlKey(datasetId: EnvPermitDatasetId): string {
  return ENV_URL_KEYS[datasetId];
}

export async function fetchEnvScaffoldPermits(
  datasetId: EnvPermitDatasetId,
  options?: { minIssueDate?: Date }
) {
  const url = process.env[ENV_URL_KEYS[datasetId]];
  if (!url) return [];

  const cfg = DATASETS[datasetId];
  const cap = getSyncLimit(datasetId);
  const text = await fetchText(url, 25_000_000);
  if (!text) return [];

  const { rows } = parseCsvText(text, cap * 2);
  const minTs = options?.minIssueDate?.getTime();
  const out: {
    externalId: string;
    permitType: string;
    address: string;
    borough?: string;
    city?: string;
    estimatedCost?: number;
    issueDate?: Date;
    sourceUrl: string;
  }[] = [];

  for (const row of rows) {
    const issueDate = parseDate(pick(row, "date", "issue_date", "DATE", "date_emission"));
    if (minTs && issueDate && issueDate.getTime() < minTs) continue;
    if (out.length >= cap) break;
    const externalId =
      pick(row, "id", "no_permis", "numero", "NUMERO") || `${datasetId}-${out.length}`;
    const address =
      pick(row, "adresse", "address", "ADRESSE", "emplacement") || cfg.city || "Québec";
    out.push({
      externalId: `${datasetId}-${externalId}`,
      permitType: pick(row, "type", "type_travaux", "TYPE") || "Construction",
      address,
      borough: pick(row, "arrondissement", "borough") || undefined,
      city: cfg.city,
      issueDate,
      sourceUrl: cfg.sourceUrl,
    });
  }
  return out.sort((a, b) => (b.issueDate?.getTime() ?? 0) - (a.issueDate?.getTime() ?? 0));
}

export async function fetchRegulatoryCsv(
  datasetId: Extract<
    DatasetId,
    "amp-registry" | "rbq-infractions" | "inspection-violations-mtl"
  >
) {
  const envKey =
    datasetId === "amp-registry"
      ? "AMP_REGISTRY_URL"
      : datasetId === "rbq-infractions"
        ? "RBQ_INFRACTIONS_URL"
        : "MTL_INSPECTIONS_URL";
  const url = process.env[envKey];
  if (!url) return [];

  const text = await fetchText(url, 10_000_000);
  if (!text) return [];
  const { rows } = parseCsvText(text, getSyncLimit(datasetId) * 2);
  return rows;
}
