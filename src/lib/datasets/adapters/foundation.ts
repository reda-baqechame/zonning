import { createHash } from "crypto";
import type { DatasetId } from "@/lib/datasets/registry";

export type SourceAdapterKind =
  | "ckan"
  | "arcgis"
  | "csv_json"
  | "shp_gpkg"
  | "wfs_wms"
  | "pdf"
  | "municipal_document";

export type RawSnapshot = {
  datasetId: DatasetId;
  kind: SourceAdapterKind;
  sourceUrl: string;
  fetchedAt: string;
  checksum: string;
  byteLength: number;
  storageKey: string;
};

export type QualityGateResult = {
  ok: boolean;
  status: "ok" | "warning" | "anomaly" | "failed";
  checks: {
    schemaDrift: boolean;
    coordinatesValid: boolean;
    duplicateRateOk: boolean;
    rowCountOk: boolean;
    freshnessOk: boolean;
  };
  message?: string;
};

export type NormalizedLayerRecord = {
  datasetId: DatasetId;
  externalId: string;
  geometryWkt?: string | null;
  municipalityCode?: string | null;
  municipalityName?: string | null;
  properties: Record<string, unknown>;
  sourceUrl: string;
  observedAt?: string | null;
};

export interface QuebecSourceAdapter {
  datasetId: DatasetId;
  kind: SourceAdapterKind;
  fetchSnapshot(): Promise<RawSnapshot>;
  normalize(snapshot: RawSnapshot): Promise<NormalizedLayerRecord[]>;
  qualityGate(records: NormalizedLayerRecord[], snapshot: RawSnapshot): Promise<QualityGateResult>;
}

export function checksumBuffer(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function defaultQualityGate(
  records: NormalizedLayerRecord[],
  previousCount?: number
): QualityGateResult {
  const rowCountOk =
    previousCount == null ||
    previousCount === 0 ||
    (records.length > previousCount * 0.5 && records.length < previousCount * 1.75);
  const ids = new Set(records.map((r) => r.externalId));
  const duplicateRateOk = records.length === 0 ? true : ids.size / records.length > 0.98;
  const coordinatesValid = records.every((r) => {
    if (!r.geometryWkt) return true;
    return !/NaN|Infinity/i.test(r.geometryWkt);
  });

  const ok = rowCountOk && duplicateRateOk && coordinatesValid;
  return {
    ok,
    status: ok ? "ok" : "anomaly",
    checks: {
      schemaDrift: false,
      coordinatesValid,
      duplicateRateOk,
      rowCountOk,
      freshnessOk: true,
    },
    message: ok ? undefined : "Quality gate detected row-count, duplicate, or coordinate anomaly.",
  };
}
