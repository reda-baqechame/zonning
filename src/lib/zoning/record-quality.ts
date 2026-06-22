import { createHash } from "node:crypto";

export type ZoningRecordEvidence = {
  city: string;
  latitude: number;
  longitude: number;
  landUse?: string | null;
  intensificationLevel?: string | null;
  densityThreshold?: number | null;
  zoneCode?: string | null;
  sourceUrl: string;
};

export function isUsableZoningRecord(record: ZoningRecordEvidence): boolean {
  const hasRuleEvidence = Boolean(
    record.landUse?.trim() ||
      record.intensificationLevel?.trim() ||
      record.zoneCode?.trim() ||
      (record.densityThreshold != null && record.densityThreshold > 0),
  );
  return Boolean(
    record.city.trim() &&
      record.latitude >= 44 &&
      record.latitude <= 63 &&
      record.longitude >= -80 &&
      record.longitude <= -57 &&
      record.sourceUrl.startsWith("https://") &&
      hasRuleEvidence,
  );
}

export function buildZoningExternalId(
  datasetId: string,
  sourceId: string | null | undefined,
  record: ZoningRecordEvidence,
): string | null {
  if (!isUsableZoningRecord(record)) return null;
  const cleanSourceId = sourceId?.trim();
  if (cleanSourceId) return `${datasetId}:${cleanSourceId}`;

  const identity = [
    datasetId,
    record.city,
    record.latitude.toFixed(6),
    record.longitude.toFixed(6),
    record.zoneCode ?? "",
    record.landUse ?? "",
    record.intensificationLevel ?? "",
    record.densityThreshold ?? "",
  ].join("|");
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `derived:${datasetId}:${digest}`;
}
