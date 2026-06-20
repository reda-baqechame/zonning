import type { DatasetId } from "@/lib/datasets/registry";

export type QualityStatus = "ok" | "warn" | "anomaly";

export type QualityRule = {
  minRowsOnFullSync?: number;
  dropPercentThreshold?: number;
  /** Allow empty sync without anomaly (bootstrap allowlist datasets). */
  allowEmpty?: boolean;
};

/** Per-dataset quality thresholds — all 33 active datasets covered. */
export const QUALITY_RULES: Partial<Record<DatasetId, QualityRule>> = {
  permits: { minRowsOnFullSync: 500, dropPercentThreshold: 30 },
  "permits-laval": { minRowsOnFullSync: 20, dropPercentThreshold: 30 },
  "permits-longueuil": { minRowsOnFullSync: 20, dropPercentThreshold: 30 },
  "permits-quebec": { minRowsOnFullSync: 20, dropPercentThreshold: 30 },
  "permits-gatineau": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-levis": { allowEmpty: true, dropPercentThreshold: 40 },
  "permit-stats": { minRowsOnFullSync: 5, dropPercentThreshold: 40 },
  "permit-delays": { minRowsOnFullSync: 5, dropPercentThreshold: 40 },
  tenders: { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  suppliers: { minRowsOnFullSync: 50, dropPercentThreshold: 35 },
  transactions: { minRowsOnFullSync: 20, dropPercentThreshold: 40 },
  "transactions-2023": { minRowsOnFullSync: 20, dropPercentThreshold: 40 },
  "transactions-2025": { allowEmpty: true, dropPercentThreshold: 40 },
  assessment: { minRowsOnFullSync: 100, dropPercentThreshold: 35 },
  contamination: { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  "contamination-gtc": { minRowsOnFullSync: 20, dropPercentThreshold: 40 },
  commercial: { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  taxes: { minRowsOnFullSync: 50, dropPercentThreshold: 40 },
  registre: { minRowsOnFullSync: 50, dropPercentThreshold: 30 },
  awards: { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  rbq: { minRowsOnFullSync: 500, dropPercentThreshold: 30 },
  heritage: { minRowsOnFullSync: 20, dropPercentThreshold: 40 },
  "heritage-eip": { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  "heritage-lpc": { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  "pum2050-heritage": { minRowsOnFullSync: 10, dropPercentThreshold: 40 },
  contracts: { minRowsOnFullSync: 20, dropPercentThreshold: 40 },
  "contracts-boroughs": { allowEmpty: true, dropPercentThreshold: 40 },
  roadworks: { minRowsOnFullSync: 5, dropPercentThreshold: 40 },
  "roadworks-saguenay": { minRowsOnFullSync: 3, dropPercentThreshold: 40 },
  "pum2050-zoning": { minRowsOnFullSync: 50, dropPercentThreshold: 40 },
  "zoning-trois-rivieres": { minRowsOnFullSync: 5, dropPercentThreshold: 40 },
  "projects-sherbrooke": { minRowsOnFullSync: 5, dropPercentThreshold: 40 },
  "projects-brossard": { allowEmpty: true, dropPercentThreshold: 40 },
  "toronto-permits": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-sherbrooke": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-trois-rivieres": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-saguenay": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-terrebonne": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-repentigny": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-brossard": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-saint-jean-richelieu": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-drummondville": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-saint-jerome": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-granby": { allowEmpty: true, dropPercentThreshold: 40 },
  "permits-saint-hyacinthe": { allowEmpty: true, dropPercentThreshold: 40 },
  "zoning-sherbrooke": { allowEmpty: true, dropPercentThreshold: 40 },
  "zoning-quebec": { allowEmpty: true, dropPercentThreshold: 40 },
  "zoning-laval": { allowEmpty: true, dropPercentThreshold: 40 },
  "zoning-longueuil": { allowEmpty: true, dropPercentThreshold: 40 },
  "amp-registry": { allowEmpty: true, dropPercentThreshold: 40 },
  "rbq-infractions": { allowEmpty: true, dropPercentThreshold: 40 },
  "seao-standing-offers": { allowEmpty: true, dropPercentThreshold: 40 },
  "inspection-violations-mtl": { allowEmpty: true, dropPercentThreshold: 40 },
};

export function evaluateQuality(input: {
  datasetId: DatasetId;
  rowsIngested: number;
  hadPriorSuccess: boolean;
  priorMedianIngested?: number;
  syncOk: boolean;
  source: string;
  isIncrementalSync?: boolean;
}): { status: QualityStatus; message?: string } {
  if (!input.syncOk) {
    return { status: "anomaly", message: "Sync failed" };
  }

  if (input.source === "error") {
    return { status: "anomaly", message: "Fetcher returned error" };
  }

  if (input.source === "skipped") {
    return { status: "ok" };
  }

  if (input.source === "unchanged") {
    return { status: "ok" };
  }

  const rules = QUALITY_RULES[input.datasetId];

  if (
    input.hadPriorSuccess &&
    input.rowsIngested === 0 &&
    input.source === "empty" &&
    !input.isIncrementalSync &&
    !rules?.allowEmpty
  ) {
    return {
      status: "anomaly",
      message: "Zero rows ingested after prior successful sync",
    };
  }

  if (
    rules?.minRowsOnFullSync &&
    input.rowsIngested > 0 &&
    input.rowsIngested < rules.minRowsOnFullSync &&
    !input.isIncrementalSync
  ) {
    return {
      status: "warn",
      message: `Low row count on full sync (${input.rowsIngested} < ${rules.minRowsOnFullSync})`,
    };
  }

  if (
    rules?.dropPercentThreshold &&
    input.priorMedianIngested &&
    input.priorMedianIngested > 0 &&
    input.rowsIngested > 0
  ) {
    const drop =
      ((input.priorMedianIngested - input.rowsIngested) / input.priorMedianIngested) * 100;
    if (drop >= rules.dropPercentThreshold) {
      return {
        status: "anomaly",
        message: `Row count dropped ${drop.toFixed(0)}% vs 7-day median`,
      };
    }
  }

  return { status: "ok" };
}
