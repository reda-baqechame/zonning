import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import { parseCsvTextLarge, pick, parseMoney, parseDate, parseFloatSafe } from "../parser";

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

export async function fetchPermits(
  limit?: number,
  options?: FetchPermitOptions
): Promise<PermitRecord[]> {
  const cap = limit ?? getSyncLimit("permits");
  const maxAgeDays = options?.maxAgeDays ?? 365;
  const minDate = options?.minIssueDate;
  const cutoff = minDate
    ? minDate.getTime()
    : Date.now() - maxAgeDays * 86400000;
  const resourceUrl = await fetchCkanResourceUrl(
    DATASETS.permits.ckanId,
    DATASETS.permits.preferredFormat
  );
  if (!resourceUrl) {
    throw new Error("CKAN resource URL not found for permits");
  }

  const text = await fetchText(resourceUrl, 50_000_000);
  if (!text) {
    throw new Error("Failed to fetch permit CSV");
  }

  const { rows } = parseCsvTextLarge(text, cap * 4);
  const parsed: PermitRecord[] = [];

  for (const row of rows) {
    const lat = parseFloatSafe(pick(row, "latitude", "lat", "y"));
    const lng = parseFloatSafe(pick(row, "longitude", "long", "x", "lon"));
    const externalId =
      pick(row, "no_demande", "no_dossier", "id_permis", "numero_dossier", "id_dossier", "id") ||
      `permit-${parsed.length}`;

    const address =
      pick(row, "emplacement", "adresse", "adresse_travaux") ||
      `${pick(row, "no_civique", "nocivique")} ${pick(row, "nom_rue", "rue", "adresse_rue")}`.trim() ||
      "Montréal";

    parsed.push({
      externalId,
      permitNumber: pick(row, "id_permis", "numero_permis", "no_permis", "permis"),
      permitType:
        pick(row, "description_type_demande", "type_travaux", "type", "categorie", "description_travaux") ||
        "Construction",
      workType: pick(row, "nature_travaux", "description", "travaux"),
      borough: pick(row, "arrondissement", "borough", "arrond"),
      address,
      matricule: pick(row, "matricule", "idu", "no_matricule", "matricule83") || undefined,
      latitude: lat,
      longitude: lng,
      estimatedCost: parseMoney(
        pick(row, "cout_estime", "cout", "estimated_cost", "valeur", "montant")
      ),
      issueDate: parseDate(
        pick(row, "date_emission", "date_delivrance", "date_permis", "date")
      ),
      applicantName: pick(row, "demandeur", "entrepreneur", "nom_demandeur"),
      sourceUrl: DATASETS.permits.sourceUrl,
      city: "Montréal",
    });
  }

  parsed.sort((a, b) => {
    const ta = a.issueDate?.getTime() ?? 0;
    const tb = b.issueDate?.getTime() ?? 0;
    return tb - ta;
  });

  const recent = parsed.filter((p) => {
    if (!p.issueDate) return true;
    const t = p.issueDate.getTime();
    if (t < cutoff) return false;
    if (options?.maxIssueDate && t >= options.maxIssueDate.getTime()) return false;
    return true;
  });

  return recent.slice(0, cap);
}

/** Date-window pagination for full CKAN coverage (newest-first windows). */
export async function fetchPermitsPaginated(
  totalCap: number,
  options?: FetchPermitOptions
): Promise<PermitRecord[]> {
  if (options?.minIssueDate) {
    return fetchPermits(totalCap, options);
  }

  const all: PermitRecord[] = [];
  const seen = new Set<string>();
  const windowSize = Math.min(5000, totalCap);
  let maxIssueDate: Date | undefined;

  for (let pass = 0; pass < 20 && all.length < totalCap; pass++) {
    const batch = await fetchPermits(windowSize, { ...options, maxIssueDate });
    if (batch.length === 0) break;

    for (const p of batch) {
      if (!seen.has(p.externalId)) {
        seen.add(p.externalId);
        all.push(p);
      }
    }

    const oldest = batch[batch.length - 1]?.issueDate;
    if (!oldest || batch.length < 50) break;
    maxIssueDate = oldest;
  }

  return all.slice(0, totalCap);
}
