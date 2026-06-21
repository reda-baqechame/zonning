/**
 * CKAN harvest engine — the data multiplier.
 *
 * Données Québec (donneesquebec.ca) is a CKAN portal exposing ~1,588 datasets
 * from 139 organizations. Instead of hand-registering datasets one by one, this
 * engine crawls the whole catalog, classifies each dataset by construction
 * relevance, and returns ranked candidates ready to wire into the registry.
 *
 * This is what takes ZONNING from "49 registered datasets" to "all of Quebec".
 *
 * Usable from:
 *  - scripts/harvest-quebec.ts (CLI: npm run harvest:quebec)
 *  - /api/admin/harvest (admin preview / trigger)
 */

export const CKAN_BASE = "https://www.donneesquebec.ca/recherche/api/3/action";

export type HarvestCategory =
  | "permits"
  | "assessment"
  | "transactions"
  | "tenders"
  | "companies"
  | "rbq"
  | "contamination"
  | "heritage"
  | "zoning"
  | "flood"
  | "wetlands"
  | "protected_areas"
  | "cadastral"
  | "addresses"
  | "roadworks"
  | "development"
  | "commercial"
  | "contracts"
  | "inspection"
  | "cnesst"
  | "other";

export type CkanResource = {
  id: string;
  url: string;
  format?: string;
  name?: string;
  lastModified?: string;
};

export type HarvestCandidate = {
  ckanId: string;
  title: string;
  organization?: string;
  category: HarvestCategory;
  city?: string;
  relevance: number; // 0–100
  resources: CkanResource[];
  preferredResource?: CkanResource;
  notes?: string;
  sourceUrl: string;
  lastModified?: string;
};

export type HarvestResult = {
  totalScanned: number;
  candidates: HarvestCandidate[];
  byCategory: Record<HarvestCategory, number>;
  newCandidates: number; // not already in registry
  harvestedAt: string;
};

type CkanPackage = {
  id: string;
  name: string;
  title?: string;
  notes?: string;
  organization?: { title?: string; name?: string };
  groups?: { name?: string; display_name?: string }[];
  tags?: { name?: string }[];
  resources?: {
    id: string;
    url: string;
    format?: string;
    name?: string;
    last_modified?: string;
  }[];
  metadata_modified?: string;
  modified?: string;
};

// ---- Classification --------------------------------------------------------

const CATEGORY_KEYWORDS: Record<Exclude<HarvestCategory, "other">, string[]> = {
  permits: ["permis de construction", "permis construire", "permis de batir", "building permit", "permis de démoli", "permis de transformer"],
  assessment: ["rôle d'évaluation", "role d'evaluation", "évaluation foncière", "evaluation fonciere", "assessment roll", "rôles d'évaluation"],
  transactions: ["ventes immobilières", "ventes immobilieres", "transactions immobilières", "transferts de propriété", "property sales", "vente immobilière"],
  tenders: ["appel d'offres", "appels d'offres", "seao", "sousmissions", "marchés publics", "appel d`offres"],
  companies: ["registre des entreprises", "entreprise", "fournisseur", "suppliers", "répertoire des entreprise"],
  rbq: ["rbq", "licence de constructeur", "régie du bâtiment", "regie du batiment"],
  contamination: ["terrain contaminé", "terrains contaminés", "contamination", "gtc", "gestion des terrains contaminés", "sol contaminé"],
  heritage: ["patrimoine", "patrimonial", "site patrimonial", "cité de l'architecture", "heritage"],
  zoning: ["zonage", "règlement de zonage", "plan d'urbanisme", "pum", "règlement d'urbanisme", "zoning", "plan de zonage"],
  flood: ["zone inondable", "zones inondables", "inondation", "cartographie des zones inondables", "flood"],
  wetlands: ["milieux humides", "milieu humide", "wetlands", "tourbière"],
  protected_areas: ["aires protégées", "aire protégée", "réserve naturelle", "protected area", "conservation"],
  cadastral: ["cadastre", "cadastral", "lots cadastraux", "matrice cadastrale"],
  addresses: ["adresses", "adresse civique", "adresses du québec", "répertoire d'adresses", "points d'adresse"],
  roadworks: ["travaux routiers", "chantiers routiers", "roadwork", "travaux de voirie", "réseau routier", "road network"],
  development: ["projet de développement", "projets immobiliers", "développement résidentiel", "projets de construction", "development project"],
  commercial: ["locaux commerciaux vacants", "vacances commerciales", "commercial vacancy", "locales vacants"],
  contracts: ["contrats municipaux", "contrats accordés", "municipal contracts", "dépenses par fournisseur"],
  inspection: ["inspection", "infractions", "violations", "avis d'infraction", "inspection municipale"],
  cnesst: ["cnesst", "établissements actifs", "établissement", "lsst", "santé sécurité travail"],
};

const QUEBEC_CITIES = [
  "Montréal", "Montreal", "Laval", "Québec", "Quebec", "Gatineau", "Longueuil",
  "Sherbrooke", "Lévis", "Levis", "Trois-Rivières", "Trois-Rivieres", "Saguenay",
  "Terrebonne", "Repentigny", "Brossard", "Saint-Jean-sur-Richelieu", "Saint-Jean",
  "Drummondville", "Saint-Jérôme", "Saint-Jerome", "Granby", "Saint-Hyacinthe",
  "Blainville", "Mirabel", "Châteauguay", "Chicoutimi", "Jonquière", "Victoriaville",
  "Shawinigan", "Beloeil", "Pointe-Claire", "Dollard-des-Ormeaux",
];

function classify(text: string): { category: HarvestCategory; score: number } {
  const hay = text.toLowerCase();
  let best: HarvestCategory = "other";
  let bestScore = 0;
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS) as [Exclude<HarvestCategory, "other">, string[]][]) {
    let score = 0;
    for (const kw of kws) {
      if (hay.includes(kw)) score += kw.length > 10 ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return { category: best, score: bestScore };
}

function inferCity(text: string): string | undefined {
  const hay = text.toLowerCase();
  for (const c of QUEBEC_CITIES) {
    if (hay.includes(c.toLowerCase())) {
      // Normalize a few.
      if (c === "Montreal") return "Montréal";
      if (c === "Levis") return "Lévis";
      if (c === "Quebec") return "Québec";
      if (c === "Trois-Rivieres") return "Trois-Rivières";
      if (c === "Saint-Jerome") return "Saint-Jérôme";
      return c;
    }
  }
  return undefined;
}

const PREFERRED_FORMATS = ["CSV", "csv", "GeoJSON", "geojson", "JSON", "json", "SHP", "shp", "FGDB", "fgdb", "KML", "kml"];

function pickPreferredResource(resources: CkanResource[]): CkanResource | undefined {
  if (!resources.length) return undefined;
  for (const fmt of PREFERRED_FORMATS) {
    const r = resources.find((x) => (x.format ?? "").toLowerCase() === fmt.toLowerCase());
    if (r) return r;
  }
  return resources[0];
}

function packageToCandidate(pkg: CkanPackage): HarvestCandidate | null {
  const text = [pkg.title, pkg.notes, pkg.organization?.title, ...(pkg.tags ?? []).map((t) => t.name), ...(pkg.groups ?? []).map((g) => g.display_name)].filter(Boolean).join(" ");
  const { category, score } = classify(text);
  if (category === "other" || score === 0) return null;

  const resources: CkanResource[] = (pkg.resources ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      id: r.id,
      url: r.url,
      format: r.format,
      name: r.name,
      lastModified: r.last_modified,
    }));

  if (!resources.length) return null;

  const city = inferCity(text);
  const lastModified = pkg.metadata_modified ?? pkg.modified ?? resources[0]?.lastModified;
  const relevance = Math.min(100, 40 + score * 10 + (city ? 10 : 0) + (resources.length > 1 ? 5 : 0));

  return {
    ckanId: pkg.name ?? pkg.id,
    title: pkg.title ?? pkg.name,
    organization: pkg.organization?.title,
    category,
    city,
    relevance,
    resources,
    preferredResource: pickPreferredResource(resources),
    notes: pkg.notes ? pkg.notes.slice(0, 280) : undefined,
    sourceUrl: `https://www.donneesquebec.ca/recherche/dataset/${pkg.name ?? pkg.id}`,
    lastModified,
  };
}

// ---- Crawl -----------------------------------------------------------------

export type HarvestOptions = {
  /** Max datasets to scan (default 1600 — covers the whole catalog). */
  maxRows?: number;
  /** Page size per CKAN request (default 100). */
  rowsPerPage?: number;
  /** Optional search query to narrow the crawl. */
  query?: string;
  /** Skip candidates already present in the registry (by ckanId). */
  knownCkanIds?: Set<string>;
  /** Minimum relevance to keep (default 50). */
  minRelevance?: number;
  /** Called per page for progress reporting. */
  onPage?: (scanned: number, kept: number) => void;
};

export async function harvestCkanCatalog(opts: HarvestOptions = {}): Promise<HarvestResult> {
  const maxRows = opts.maxRows ?? 1600;
  const rowsPerPage = opts.rowsPerPage ?? 100;
  const minRelevance = opts.minRelevance ?? 50;
  const known = opts.knownCkanIds ?? new Set<string>();

  const candidates: HarvestCandidate[] = [];
  let scanned = 0;
  let start = 0;

  while (start < maxRows) {
    const q = opts.query ? `&q=${encodeURIComponent(opts.query)}` : "";
    const url = `${CKAN_BASE}/package_search?rows=${rowsPerPage}&start=${start}${q}`;
    let results: CkanPackage[] = [];
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        console.warn(`[harvest] page ${start} returned HTTP ${res.status}; stopping`);
        break;
      }
      const data = (await res.json()) as { result?: { results?: CkanPackage[]; count?: number }; error?: unknown };
      if (data.error) {
        console.warn(`[harvest] CKAN error on page ${start}; stopping`, data.error);
        break;
      }
      results = data.result?.results ?? [];
      if (!results.length) break;
    } catch (err) {
      console.warn(`[harvest] fetch failed on page ${start}:`, (err as Error).message);
      break;
    }

    for (const pkg of results) {
      scanned++;
      const cand = packageToCandidate(pkg);
      if (cand && cand.relevance >= minRelevance) candidates.push(cand);
    }

    opts.onPage?.(scanned, candidates.length);
    if (results.length < rowsPerPage) break;
    start += rowsPerPage;
  }

  // Dedupe by ckanId, keep highest relevance.
  const dedup = new Map<string, HarvestCandidate>();
  for (const c of candidates) {
    const existing = dedup.get(c.ckanId);
    if (!existing || c.relevance > existing.relevance) dedup.set(c.ckanId, c);
  }

  const final = Array.from(dedup.values()).sort((a, b) => b.relevance - a.relevance);
  const byCategory = final.reduce(
    (acc, c) => {
      acc[c.category] = (acc[c.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<HarvestCategory, number>
  );
  const newCandidates = final.filter((c) => !known.has(c.ckanId)).length;

  return {
    totalScanned: scanned,
    candidates: final,
    byCategory,
    newCandidates,
    harvestedAt: new Date().toISOString(),
  };
}

/** Build the set of ckanIds already registered, for newness filtering. */
export async function getKnownCkanIds(): Promise<Set<string>> {
  try {
    const { DATASETS } = await import("@/lib/datasets/registry");
    const known = new Set<string>();
    for (const cfg of Object.values(DATASETS)) {
      if (cfg.ckanId) known.add(cfg.ckanId);
    }
    return known;
  } catch {
    return new Set();
  }
}
