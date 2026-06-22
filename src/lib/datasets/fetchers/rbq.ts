import {
  fetchCkanPackage,
  fetchCkanResourceUrl,
  fetchCkanDatastoreSearch,
  fetchText,
} from "../client";
import { DATASETS } from "../registry";
import { parseCsvTextLarge, pick, parseDate } from "../parser";

export type RbqLicenseRecord = {
  licenseNumber: string;
  holderName?: string;
  subclass?: string;
  status?: string;
  expiryDate?: Date;
  sourceUrl: string;
};

export type RbqPageResult = {
  records: RbqLicenseRecord[];
  fetched: number;
  complete: boolean;
};

function mapRbqRow(row: Record<string, string>, sourceUrl: string): RbqLicenseRecord | null {
  const licenseNumber = pick(
    row,
    "numero de licence",
    "numéro de licence",
    "numerolicence",
    "no_licence",
    "numero_licence",
    "licence",
    "numerodelicence",
    "no_rbq",
    "NumeroLicence",
    "NUMERO_LICENCE",
  );
  if (!licenseNumber) return null;

  const statusRaw = pick(
    row,
    "statut de la licence",
    "statutlicence",
    "statut",
    "status",
    "StatutLicence",
  ).toLowerCase();

  return {
    licenseNumber: licenseNumber.replace(/\s/g, ""),
    holderName: pick(
      row,
      "nom de l'intervenant",
      "nom de lintervenant",
      "nom",
      "nomtitulaire",
      "titulaire",
      "raisonsociale",
      "nomentreprise",
      "Nom",
      "NomTitulaire",
    ),
    subclass: pick(
      row,
      "sous-categories",
      "sous categories",
      "sousclasse",
      "sous_classe",
      "subclasse",
      "categorie",
      "type de licence",
      "classelicence",
      "SousClasse",
    ),
    status:
      statusRaw.includes("actif") || statusRaw.includes("active") || !statusRaw
        ? "active"
        : statusRaw,
    expiryDate: parseDate(
      pick(
        row,
        "date du paiement annuel",
        "dateexpiration",
        "date_expiration",
        "expiration",
        "fin",
        "DateExpiration",
      ),
    ),
    sourceUrl,
  };
}

let cachedRbqResourceId: string | null = null;
/** Cached per cold start: whether the CKAN DataStore API serves this resource. */
let rbqDatastoreAvailable: boolean | null = null;

async function getRbqResourceId(): Promise<string | null> {
  if (cachedRbqResourceId) return cachedRbqResourceId;
  const cfg = DATASETS.rbq;
  const pkg = await fetchCkanPackage(cfg.ckanId);
  const csvResource = pkg?.resources.find(
    (r) =>
      r.format?.toUpperCase() === "CSV" || r.url?.toLowerCase().endsWith(".csv")
  );
  cachedRbqResourceId = csvResource?.id ?? null;
  return cachedRbqResourceId;
}

/** Page via the CKAN DataStore search API (paginated, no full download). */
async function fetchRbqDatastorePage(
  resourceId: string,
  offset: number,
  batchSize: number
): Promise<RbqPageResult> {
  const cfg = DATASETS.rbq;
  const page = Math.min(1000, batchSize);
  const records: RbqLicenseRecord[] = [];
  let fetched = 0;
  let cursor = offset;

  while (records.length < batchSize) {
    const rows = await fetchCkanDatastoreSearch(resourceId, page, cursor);
    if (rows.length === 0) {
      return { records, fetched, complete: true };
    }

    for (const raw of rows) {
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v ?? "")])
      );
      const mapped = mapRbqRow(normalized, cfg.sourceUrl);
      if (mapped) records.push(mapped);
      if (records.length >= batchSize) break;
    }

    fetched += rows.length;
    cursor += rows.length;
    if (rows.length < page) {
      return { records, fetched, complete: true };
    }
  }

  return { records, fetched, complete: false };
}

export async function fetchRbqLicensesPage(
  offset: number,
  batchSize: number
): Promise<RbqPageResult> {
  const cfg = DATASETS.rbq;
  const resourceId = await getRbqResourceId();

  // Prefer the DataStore search API (paginated, avoids downloading the full
  // CSV). Many Données Québec resources don't have DataStore enabled — in that
  // case the search returns an empty result. Probe once per cold start and fall
  // back to a direct CSV fetch so RBQ licenses are actually ingested (without
  // this, rbqLicenses stays at 0 while the sync falsely reports "complete").
  if (resourceId) {
    if (rbqDatastoreAvailable === null) {
      const probe = await fetchCkanDatastoreSearch(resourceId, 1, 0);
      rbqDatastoreAvailable = probe.length > 0;
    }
    if (rbqDatastoreAvailable) {
      return fetchRbqDatastorePage(resourceId, offset, batchSize);
    }
  }

  const resourceUrl = await fetchCkanResourceUrl(cfg.ckanId, "CSV");
  if (resourceUrl) {
    const text = await fetchText(resourceUrl, 20_000_000);
    if (text) {
      const { rows } = parseCsvTextLarge(text, offset + batchSize);
      const slice = rows.slice(offset, offset + batchSize);
      const records = slice
        .map((row) => mapRbqRow(row, cfg.sourceUrl))
        .filter((r): r is RbqLicenseRecord => r != null);
      return {
        records,
        fetched: slice.length,
        complete: offset + slice.length >= rows.length,
      };
    }
  }

  if (process.env.NODE_ENV === "production") {
    return { records: [], fetched: 0, complete: true };
  }

  return {
    records: [
      {
        licenseNumber: "1234-5678-01",
        holderName: "Dupont Électrique Inc.",
        subclass: "4.1",
        status: "active",
        sourceUrl: cfg.sourceUrl,
      },
    ],
    fetched: 1,
    complete: true,
  };
}

export async function fetchRbqLicenses(limit?: number): Promise<RbqLicenseRecord[]> {
  const cap = limit ?? 500;
  const { records } = await fetchRbqLicensesPage(0, cap);
  return records;
}

export function normalizeLicenseNumber(num: string): string {
  return num.replace(/\s/g, "").toUpperCase();
}
