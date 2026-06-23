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

type ResolvedTenderResource =
  | { kind: "datastore"; id: string }
  | { kind: "csv"; url: string };

/** Resolve the datastore resource for open tender notices. */
async function resolveOpenTendersResource(): Promise<ResolvedTenderResource | null> {
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
      resources.find(
        (r) =>
          /open/i.test(r.name ?? "") &&
          (r.format?.toUpperCase() === "CSV" || /openTenderNotice/i.test(r.url)),
      );
    if (!preferred) {
      dataWarn("canadabuys.no-open-resource", { count: resources.length });
      return null;
    }
    if (preferred.datastore_active) {
      return { kind: "datastore", id: preferred.id };
    }

    const csvUrl =
      preferred.format?.toUpperCase() === "CSV" && !preferred.url.endsWith(".csv")
        ? `${preferred.url}.csv`
        : preferred.url;
    return { kind: "csv", url: csvUrl };
  } catch (e) {
    dataWarn("canadabuys.package_show.error", { error: String(e) });
    return null;
  }
}

/** Coerce a raw datastore record into a CanadaBuysRecord, or null to skip. */
export function toCanadaBuysRecord(row: Record<string, unknown>, now: number): CanadaBuysRecord | null {
  const title =
    str(row, ["title", "title_en", "titre", "notice_title", "objet"]) ??
    str(row, ["title-titre-eng", "title-titre-fra"]) ??
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
      "referenceNumber-numeroReference",
      "solicitationNumber-numeroSollicitation",
    ]) ?? "";
  if (!externalId) return null;

  const statusRaw =
    str(row, [
      "status",
      "notice_status",
      "status_en",
      "tenderStatus-appelOffresStatut-eng",
      "tenderStatus-appelOffresStatut-fra",
    ])?.toLowerCase() ?? "";
  // Skip explicitly closed/cancelled notices (we want open ones).
  if (statusRaw.includes("cancel") || statusRaw.includes("expired")) return null;

  const closesAt = dateOf(
    row,
    [
      "closing_date",
      "tender_period_enddate",
      "end_date",
      "closing",
      "date_de_cloture",
      "tenderClosingDate-appelOffresDateCloture",
    ],
  );
  if (closesAt && closesAt.getTime() < now - 7 * 86_400_000) return null;

  const publishedAt = dateOf(
    row,
    [
      "publication_date",
      "publish_date",
      "amendment_date",
      "date_publication",
      "start_date",
      "publicationDate-datePublication",
      "amendmentDate-dateModification",
    ],
  );
  const estimatedValue = num(row, ["estimated_value", "contract_value", "value"]);
  const unspsc = str(row, ["unspsc", "classification_code", "commodity_code", "gsin-nibs"]);
  const organization =
    str(row, [
      "buying_organization",
      "owner_org",
      "department",
      "organization_en",
      "buyer",
      "contractingEntityName-nomEntitContractante-eng",
      "contractingEntityName-nomEntitContractante-fra",
    ]) ??
    "Government of Canada";
  const category =
    str(row, [
      "procurement_method",
      "notice_type",
      "opportunity_type",
      "procurementMethod-methodeApprovisionnement-eng",
      "noticeType-avisType-eng",
    ]) ?? undefined;
  const region =
    str(row, [
      "region",
      "region_of_delivery",
      "delivery_location",
      "regionsOfDelivery-regionsLivraison-eng",
      "regionsOfOpportunity-regionAppelOffres-eng",
    ]) ?? "Canada";

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
      str(row, [
        "description",
        "description_en",
        "summary",
        "abstract",
        "tenderDescription-descriptionAppelOffres-eng",
        "tenderDescription-descriptionAppelOffres-fra",
      ]) ?? undefined,
    requiresAmp: false, // AMP is a Quebec mechanism; not applicable federally.
    sourceUrl:
      str(row, ["noticeURL-URLavis-eng", "noticeURL-URLavis-fra"]) ??
      DATASETS.canadabuys.sourceUrl,
    unspsc: unspsc ?? undefined,
    status:
      str(row, [
        "status",
        "notice_status",
        "tenderStatus-appelOffresStatut-eng",
        "tenderStatus-appelOffresStatut-fra",
      ]) ?? "open",
  };
}

export async function fetchCanadaBuys(limit?: number): Promise<{ records: CanadaBuysRecord[] }> {
  const cap = limit ?? getSyncLimit("canadabuys");
  const resource = await resolveOpenTendersResource();
  if (!resource) return { records: [] };

  if (resource.kind === "csv") {
    try {
      const res = await politeFetchWithRetry(
        resource.url,
        {
          headers: {
            Accept: "text/csv,*/*",
            "User-Agent": "ZONNING/0.1 (+https://zonning.vercel.app)",
          },
        },
        { timeoutMs: 90_000 },
      );
      if (!res.ok) {
        dataWarn("canadabuys.csv", { status: res.status });
        return { records: [] };
      }
      const rows = parseCsvRows(await res.text(), cap * 3);
      const seen = new Set<string>();
      const records: CanadaBuysRecord[] = [];
      const now = Date.now();
      for (const row of rows) {
        const rec = toCanadaBuysRecord(row, now);
        if (!rec || seen.has(rec.externalId)) continue;
        seen.add(rec.externalId);
        records.push(rec);
        if (records.length >= cap) break;
      }
      return { records };
    } catch (e) {
      dataWarn("canadabuys.csv.error", { error: String(e) });
      return { records: [] };
    }
  }

  const seen = new Set<string>();
  const records: CanadaBuysRecord[] = [];
  const now = Date.now();
  const pageSize = Math.min(200, cap);
  let offset = 0;

  while (records.length < cap) {
    const url =
      `${OGP_CKAN_API}/datastore_search?resource_id=${resource.id}` +
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

export function parseCsvRows(text: string, maxRows = Number.POSITIVE_INFINITY): Record<string, string>[] {
  const parsed: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      parsed.push(row);
      if (parsed.length > maxRows) break;
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    parsed.push(row);
  }

  const [headersRaw, ...dataRows] = parsed;
  if (!headersRaw) return [];
  const headers = headersRaw.map((h) => h.replace(/^\uFEFF/, "").trim());
  const out: Record<string, string>[] = [];
  for (const cells of dataRows) {
    if (out.length >= maxRows) break;
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx]?.trim() ?? "";
    });
    if (Object.values(record).some((v) => v.length > 0)) out.push(record);
  }
  return out;
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
