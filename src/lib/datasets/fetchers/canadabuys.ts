import { politeFetchWithRetry } from "@/lib/http/polite-fetch";
import { dataWarn } from "@/lib/datasets/log";
import { DATASETS, getSyncLimit } from "../registry";

/**
 * CanadaBuys federal tender notices.
 *
 * Source: the Open Government Portal dataset
 * https://open.canada.ca/data/en/dataset/6abd20d4-7a1c-4b38-baa2-9525d0bb2fd2
 * under the Open Government Licence – Canada. The portal exposes a CKAN
 * datastore API; we resolve the resource that holds OPEN tender notices and
 * page through it.
 *
 * Only OPEN/PUBLIC notices are read. ZONNING never logs into CanadaBuys and
 * never accesses paid or account-restricted documents.
 */

export type CanadaBuysRecord = {
  externalId: string;
  title: string;
  organization?: string;
  category?: string;
  region?: string;
  estimatedValue?: number;
  publishedAt?: Date;
  closesAt?: Date;
  summary?: string;
  requiresAmp?: boolean;
  sourceUrl: string;
  unspsc?: string;
  status?: string;
};

const OGP_CKAN_API = "https://open.canada.ca/data/api/3/action";
const OGP_DATASET_ID = DATASETS.canadabuys.ckanId;

type OgpResource = {
  id: string;
  url: string;
  format?: string;
  name?: string;
  datastore_active?: boolean;
};

/** Resolve the datastore resource for open tender notices. */
async function resolveOpenTendersResource(): Promise<string | null> {
  const url = `${OGP_CKAN_API}/package_show?id=${OGP_DATASET_ID}`;
  try {
    const res = await politeFetchWithRetry(url, undefined, { timeoutMs: 60_000 });
    if (!res.ok) {
      dataWarn("canadabuys.package_show", { status: res.status });
      return null;
    }
    const data = (await res.json()) as {
      result?: { resources?: OgpResource[] };
    };
    const resources = data.result?.resources ?? [];
    // Prefer a datastore-active JSON resource named for "open" tenders.
    const preferred =
      resources.find(
        (r) =>
          r.datastore_active &&
          /open/i.test(r.name ?? "") &&
          (r.format?.toUpperCase() === "JSON" || r.url.endsWith(".json")),
      ) ??
      resources.find(
        (r) => r.datastore_active && r.format?.toUpperCase() === "JSON",
      ) ??
      resources.find((r) => /open/i.test(r.name ?? ""));
    if (!preferred) {
      dataWarn("canadabuys.no-open-resource", { count: resources.length });
      return null;
    }
    return preferred.id;
  } catch (e) {
    dataWarn("canadabuys.package_show.error", { error: String(e) });
    return null;
  }
}

/** Coerce a raw datastore record into a CanadaBuysRecord, or null to skip. */
export function toCanadaBuysRecord(row: Record<string, unknown>, now: number): CanadaBuysRecord | null {
  const title =
    str(row, ["title", "title_en", "titre", "notice_title", "objet"]) ??
    str(row, ["solicitation", "reference_number"]);
  if (!title) return null;

  const externalId =
    str(row, [
      "reference_number",
      "solicitation",
      "ref_number",
      "notice_ref_number",
      "ocid",
      "id",
    ]) ?? "";
  if (!externalId) return null;

  const statusRaw = str(row, ["status", "notice_status", "status_en"])?.toLowerCase() ?? "";
  // Skip explicitly closed/cancelled notices (we want open ones).
  if (statusRaw.includes("cancel") || statusRaw.includes("expired")) return null;

  const closesAt = dateOf(
    row,
    ["closing_date", "tender_period_enddate", "end_date", "closing", "date_de_cloture"],
  );
  if (closesAt && closesAt.getTime() < now - 7 * 86_400_000) return null;

  const publishedAt = dateOf(
    row,
    ["publication_date", "publish_date", "amendment_date", "date_publication", "start_date"],
  );
  const estimatedValue = num(row, ["estimated_value", "contract_value", "value"]);
  const unspsc = str(row, ["unspsc", "classification_code", "commodity_code"]);
  const organization =
    str(row, ["buying_organization", "owner_org", "department", "organization_en", "buyer"]) ??
    "Government of Canada";
  const category =
    str(row, ["procurement_method", "notice_type", "opportunity_type"]) ?? undefined;
  const region = str(row, ["region", "region_of_delivery", "delivery_location"]) ?? "Canada";

  return {
    externalId: `canadabuys-${externalId}`,
    title,
    organization,
    category,
    region,
    estimatedValue: estimatedValue ?? undefined,
    publishedAt,
    closesAt,
    summary:
      str(row, ["description", "description_en", "summary", "abstract"]) ?? undefined,
    requiresAmp: false, // AMP is a Quebec mechanism; not applicable federally.
    sourceUrl: DATASETS.canadabuys.sourceUrl,
    unspsc: unspsc ?? undefined,
    status: str(row, ["status", "notice_status"]) ?? "open",
  };
}

export async function fetchCanadaBuys(limit?: number): Promise<{ records: CanadaBuysRecord[] }> {
  const cap = limit ?? getSyncLimit("canadabuys");
  const resourceId = await resolveOpenTendersResource();
  if (!resourceId) return { records: [] };

  const seen = new Set<string>();
  const records: CanadaBuysRecord[] = [];
  const now = Date.now();
  const pageSize = Math.min(200, cap);
  let offset = 0;

  while (records.length < cap) {
    const url =
      `${OGP_CKAN_API}/datastore_search?resource_id=${resourceId}` +
      `&limit=${pageSize}&offset=${offset}`;
    let rows: Record<string, unknown>[];
    try {
      const res = await politeFetchWithRetry(url, undefined, { timeoutMs: 90_000 });
      if (!res.ok) {
        dataWarn("canadabuys.datastore_search", { status: res.status, offset });
        break;
      }
      const data = (await res.json()) as {
        result?: { records?: Record<string, unknown>[] };
      };
      rows = data.result?.records ?? [];
    } catch (e) {
      dataWarn("canadabuys.datastore_search.error", { error: String(e), offset });
      break;
    }

    if (rows.length === 0) break;

    for (const row of rows) {
      const rec = toCanadaBuysRecord(row, now);
      if (!rec || seen.has(rec.externalId)) continue;
      seen.add(rec.externalId);
      records.push(rec);
      if (records.length >= cap) break;
    }

    if (rows.length < pageSize) break; // last page
    offset += pageSize;
  }

  return { records };
}

/* ---------- field extraction helpers ---------- */

function str(row: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function num(row: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function dateOf(row: Record<string, unknown>, keys: string[]): Date | undefined {
  for (const k of keys) {
    const v = row[k];
    if (!v) continue;
    const d = new Date(typeof v === "string" || typeof v === "number" ? v : String(v));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
}
