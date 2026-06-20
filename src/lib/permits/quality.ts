import { createHash } from "node:crypto";
import { differenceInCalendarDays } from "date-fns";

export type PermitQualityIssue =
  | "missing_source_id"
  | "derived_identity"
  | "missing_address"
  | "placeholder_address"
  | "missing_permit_type"
  | "generic_permit_type"
  | "missing_issue_date"
  | "future_issue_date"
  | "stale_record"
  | "missing_cost"
  | "missing_coordinates"
  | "invalid_source"
  | "dataset_level_source";

export type PermitDataQuality = {
  score: number;
  grade: "high" | "medium" | "low";
  usable: boolean;
  officialSource: boolean;
  sourceScope: "record" | "dataset" | "unknown";
  issues: PermitQualityIssue[];
};

export type PermitQualityInput = {
  externalId?: string | null;
  permitNumber?: string | null;
  permitType?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  estimatedCost?: number | null;
  issueDate?: Date | string | null;
  sourceUrl?: string | null;
};

const OFFICIAL_SOURCE_HOSTS = [
  "donneesquebec.ca",
  "gouv.qc.ca",
  "quebec.ca",
  "montreal.ca",
  "laval.ca",
  "longueuil.quebec",
  "ville.quebec.qc.ca",
  "gatineau.ca",
];

const PLACEHOLDER_ADDRESSES = new Set([
  "montreal",
  "montréal",
  "quebec",
  "québec",
  "laval",
  "longueuil",
  "gatineau",
  "unknown",
  "inconnu",
  "n/a",
]);

function normalized(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isOfficialHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return OFFICIAL_SOURCE_HOSTS.some(
    (official) => host === official || host.endsWith(`.${official}`),
  );
}

function parseSource(sourceUrl: string | null | undefined) {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function hasUsableAddress(
  address: string | null | undefined,
  city?: string | null,
): boolean {
  const value = normalized(address);
  return (
    value.length >= 5 &&
    !PLACEHOLDER_ADDRESSES.has(value) &&
    (!city || value !== normalized(city))
  );
}

export function hasSpecificPermitType(type: string | null | undefined): boolean {
  const value = normalized(type);
  return Boolean(value && !["construction", "permis", "permit", "unknown", "inconnu"].includes(value));
}

export function buildPermitExternalId(
  datasetId: string,
  sourceId: string | null | undefined,
  permit: Pick<PermitQualityInput, "address" | "permitType" | "issueDate" | "city">,
): string | null {
  const cleanSourceId = sourceId?.trim();
  if (cleanSourceId) return cleanSourceId;
  if (!hasUsableAddress(permit.address, permit.city) || !permit.permitType || !permit.issueDate) {
    return null;
  }

  const date = new Date(permit.issueDate);
  if (Number.isNaN(date.getTime())) return null;
  const identity = [
    datasetId,
    normalized(permit.city),
    normalized(permit.address),
    normalized(permit.permitType),
    date.toISOString().slice(0, 10),
  ].join("|");
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 24);
  return `derived:${datasetId}:${digest}`;
}

export function assessPermitQuality(
  permit: PermitQualityInput,
  now = new Date(),
): PermitDataQuality {
  const issues: PermitQualityIssue[] = [];
  let score = 0;

  const source = parseSource(permit.sourceUrl);
  const officialSource = Boolean(source && isOfficialHost(source.hostname));
  if (!source) {
    issues.push("invalid_source");
  } else {
    score += officialSource ? 25 : 10;
  }

  const sourceId = permit.externalId?.trim();
  const derivedIdentity = sourceId?.startsWith("derived:") ?? false;
  if (!sourceId) {
    issues.push("missing_source_id");
  } else if (derivedIdentity) {
    score += 12;
    issues.push("missing_source_id");
    issues.push("derived_identity");
  } else {
    score += 20;
  }

  if (!permit.address?.trim()) {
    issues.push("missing_address");
  } else if (!hasUsableAddress(permit.address, permit.city)) {
    issues.push("placeholder_address");
  } else {
    score += /\d/.test(permit.address) ? 15 : 8;
  }

  if (!permit.permitType?.trim()) {
    issues.push("missing_permit_type");
  } else if (!hasSpecificPermitType(permit.permitType)) {
    score += 3;
    issues.push("generic_permit_type");
  } else {
    score += 10;
  }

  const issueDate = permit.issueDate ? new Date(permit.issueDate) : null;
  if (!issueDate || Number.isNaN(issueDate.getTime())) {
    issues.push("missing_issue_date");
  } else {
    const ageDays = differenceInCalendarDays(now, issueDate);
    if (ageDays < -1) {
      score += 5;
      issues.push("future_issue_date");
    } else if (ageDays > 730) {
      score += 10;
      issues.push("stale_record");
    } else {
      score += 20;
    }
  }

  if (permit.estimatedCost != null && permit.estimatedCost > 0) score += 5;
  else issues.push("missing_cost");

  const coordinatesValid =
    permit.latitude != null &&
    permit.longitude != null &&
    permit.latitude >= 44 &&
    permit.latitude <= 63 &&
    permit.longitude >= -80 &&
    permit.longitude <= -57;
  if (coordinatesValid) score += 5;
  else issues.push("missing_coordinates");

  if (permit.city?.trim()) score += 5;

  let sourceScope: PermitDataQuality["sourceScope"] = "unknown";
  if (source) {
    const sourceText = source.href.toLowerCase();
    const reference = normalized(permit.permitNumber || permit.externalId).replace(/\s/g, "");
    const compactSource = normalized(sourceText).replace(/\s/g, "");
    sourceScope =
      reference.length >= 5 && compactSource.includes(reference) ? "record" : "dataset";
    if (sourceScope === "dataset") issues.push("dataset_level_source");
  }

  score = Math.max(0, Math.min(100, score));
  const usable = Boolean(
    source &&
      sourceId &&
      hasUsableAddress(permit.address, permit.city) &&
      permit.permitType?.trim() &&
      issueDate &&
      !Number.isNaN(issueDate.getTime()) &&
      differenceInCalendarDays(now, issueDate) >= -1,
  );

  return {
    score,
    grade: score >= 80 ? "high" : score >= 55 ? "medium" : "low",
    usable,
    officialSource,
    sourceScope,
    issues,
  };
}
