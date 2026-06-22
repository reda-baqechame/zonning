import { assessPermitQuality, buildPermitExternalId } from "@/lib/permits/quality";
import { fetchCkanDatastoreSearch, fetchCkanPackage, fetchCkanResourceUrl, fetchText } from "../client";
import { parseCsvLine, parseDate, parseFloatSafe, parseMoney, pick } from "../parser";
import { DATASETS, getSyncLimit } from "../registry";

export type PermitRecord = {
  externalId: string;
  permitNumber?: string;
  permitType: string;
  workType?: string;
  borough?: string;
  address: string;
  matricule?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  estimatedCost?: number;
  issueDate?: Date;
  applicantName?: string;
  sourceUrl: string;
};

export type FetchPermitOptions = {
  maxAgeDays?: number;
  minIssueDate?: Date;
  maxIssueDate?: Date;
};

export function parsePermitRows(
  rows: Record<string, string>[],
  cap: number,
  options?: FetchPermitOptions,
): PermitRecord[] {
  const maxAgeDays = options?.maxAgeDays ?? 365;
  const cutoff = options?.minIssueDate
    ? options.minIssueDate.getTime()
    : Date.now() - maxAgeDays * 86_400_000;
  const parsed = new Map<string, { permit: PermitRecord; qualityScore: number }>();

  for (const row of rows) {
    const address =
      pick(row, "emplacement", "adresse", "adresse_travaux") ||
      `${pick(row, "no_civique", "nocivique")} ${pick(row, "nom_rue", "rue", "adresse_rue")}`.trim();
    const permitType = pick(
      row,
      "description_type_demande",
      "type_travaux",
      "type",
      "categorie",
      "description_travaux",
    );
    const issueDate = parseDate(
      pick(row, "date_emission", "date_delivrance", "date_permis", "date"),
    );
    if (!issueDate) continue;

    const issueTime = issueDate.getTime();
    if (issueTime < cutoff) continue;
    if (options?.maxIssueDate && issueTime >= options.maxIssueDate.getTime()) continue;

    const sourceId = pick(
      row,
      "no_demande",
      "no_dossier",
      "id_permis",
      "numero_dossier",
      "id_dossier",
      "id",
    );
    const externalId = buildPermitExternalId("permits", sourceId, {
      address,
      permitType,
      issueDate,
      city: "Montréal",
    });
    if (!externalId) continue;

    const permit: PermitRecord = {
      externalId,
      permitNumber: pick(row, "id_permis", "numero_permis", "no_permis", "permis") || undefined,
      permitType,
      workType: pick(row, "nature_travaux", "description", "travaux") || undefined,
      borough: pick(row, "arrondissement", "borough", "arrond") || undefined,
      address,
      matricule: pick(row, "matricule", "idu", "no_matricule", "matricule83") || undefined,
      city: "Montréal",
      latitude: parseFloatSafe(pick(row, "latitude", "lat", "y")),
      longitude: parseFloatSafe(pick(row, "longitude", "long", "x", "lon")),
      estimatedCost: parseMoney(
        pick(row, "cout_estime", "cout", "estimated_cost", "valeur", "montant"),
      ),
      issueDate,
      applicantName: pick(row, "demandeur", "entrepreneur", "nom_demandeur") || undefined,
      sourceUrl: DATASETS.permits.sourceUrl,
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

export function parseMontrealPermitRows(
  text: string,
  cap: number,
  options?: FetchPermitOptions,
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
    : Date.now() - maxAgeDays * 86_400_000;
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

export async function fetchPermits(
  limit?: number,
  options?: FetchPermitOptions,
): Promise<PermitRecord[]> {
  const cap = limit ?? getSyncLimit("permits");
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.permits.ckanId,
    DATASETS.permits.preferredFormat,
  );
  if (!resourceUrl) throw new Error("CKAN resource URL not found for permits");

  const text = await fetchText(resourceUrl, 120_000_000);
  if (!text) throw new Error("Failed to fetch permit CSV");

  const { rows } = { rows: parseMontrealPermitRows(text, cap, options) };
  return parsePermitRows(rows, cap, options);
}

let cachedPermitsResourceId: string | null = null;
let permitsDatastoreAvailable: boolean | null = null;

async function getPermitsResourceId(): Promise<string | null> {
  if (cachedPermitsResourceId) return cachedPermitsResourceId;
  const pkg = await fetchCkanPackage(DATASETS.permits.ckanId);
  const csv = pkg?.resources.find(
    (r) =>
      r.format?.toUpperCase() === "CSV" || r.url?.toLowerCase().endsWith(".csv"),
  );
  cachedPermitsResourceId = csv?.id ?? null;
  return cachedPermitsResourceId;
}

/**
 * Fetch permits newest-first via the CKAN DataStore API. Avoids downloading the
 * full ~183 MB CSV (which truncates/OOMs on serverless and lands only a partial
 * slice). Pages with `sort=date_emission desc` and stops once records fall
 * below the requested window, so only recent permits are transferred.
 */
async function fetchPermitsViaDatastore(
  resourceId: string,
  cap: number,
  options?: FetchPermitOptions,
): Promise<PermitRecord[]> {
  const maxAgeDays = options?.maxAgeDays ?? 365;
  const minTime = options?.minIssueDate
    ? options.minIssueDate.getTime()
    : Date.now() - maxAgeDays * 86_400_000;
  const maxIssueTime = options?.maxIssueDate?.getTime();
  const pageSize = 1000;
  const rows: Record<string, string>[] = [];
  let offset = 0;

  while (rows.length < cap) {
    const recs = await fetchCkanDatastoreSearch(
      resourceId,
      Math.min(pageSize, cap - rows.length + pageSize),
      offset,
      "quebec",
      "date_emission desc",
    );
    if (recs.length === 0) break;
    let stop = false;
    for (const raw of recs) {
      const row = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v ?? "")]),
      );
      const issueTime = parseDate(row.date_emission)?.getTime();
      if (!issueTime) continue;
      if (issueTime < minTime) {
        stop = true;
        break;
      }
      if (maxIssueTime && issueTime >= maxIssueTime) continue;
      rows.push(row);
      if (rows.length >= cap) {
        stop = true;
        break;
      }
    }
    offset += recs.length;
    if (stop || recs.length < pageSize) break;
  }

  return parsePermitRows(rows, cap, options);
}

/** Date-window pagination for full CKAN coverage (newest-first windows). */
export async function fetchPermitsPaginated(
  totalCap: number,
  options?: FetchPermitOptions,
): Promise<PermitRecord[]> {
  // Prefer the DataStore API (paginated, newest-first, no full-CSV download).
  const resourceId = await getPermitsResourceId();
  if (resourceId) {
    if (permitsDatastoreAvailable === null) {
      const probe = await fetchCkanDatastoreSearch(
        resourceId,
        1,
        0,
        "quebec",
        "date_emission desc",
      );
      permitsDatastoreAvailable = probe.length > 0;
    }
    if (permitsDatastoreAvailable) {
      return fetchPermitsViaDatastore(resourceId, totalCap, options);
    }
  }

  if (options?.minIssueDate) return fetchPermits(totalCap, options);

  const all: PermitRecord[] = [];
  const seen = new Set<string>();
  const windowSize = Math.min(5000, totalCap);
  let maxIssueDate: Date | undefined;

  for (let pass = 0; pass < 20 && all.length < totalCap; pass++) {
    const batch = await fetchPermits(windowSize, { ...options, maxIssueDate });
    if (batch.length === 0) break;

    for (const permit of batch) {
      if (!seen.has(permit.externalId)) {
        seen.add(permit.externalId);
        all.push(permit);
      }
    }

    const oldest = batch[batch.length - 1]?.issueDate;
    if (!oldest || batch.length < 50) break;
    maxIssueDate = oldest;
  }

  return all.slice(0, totalCap);
}
