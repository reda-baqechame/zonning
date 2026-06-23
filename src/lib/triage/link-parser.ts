/**
 * Opportunity triage link parser.
 *
 * Detects the procurement source of a pasted URL (SEAO, CanadaBuys, or a
 * generic municipal tender page) and extracts any identifier we can use to
 * resolve it against indexed records. This is a pure, deterministic function
 * with no network access — resolution against the DB happens in the route.
 *
 * ZONNING only indexes PUBLIC notices (SEAO OCDS bundles, CanadaBuys open data,
 * municipal CKAN). It never scrapes or bypasses paid tender documents.
 */

export type TriageSource = "seao" | "canadabuys" | "municipal" | "unknown";

export type ParsedTriageLink = {
  source: TriageSource;
  /** Raw identifier extracted from the URL (SEAO avis number, CanadaBuys ref, etc.). */
  sourceId: string | null;
  /** Display label for the detected source. */
  sourceLabel: string;
  /** Normalized host for logging / provenance. */
  host: string;
  /** True if the URL looks like a tender/opportunity page (vs a homepage). */
  looksLikeOpportunity: boolean;
  /** Whether ZONNING can attempt to resolve this against indexed records. */
  resolvable: boolean;
};

const SEAO_HOSTS = ["seao.ca", "www.seao.ca", "seao.com", "www.seao.com"];
const CANADABUYS_HOSTS = [
  "canadabuys.canada.ca",
  "www.canadabuys.canada.ca",
  "buyandsell.gc.ca",
  "www.buyandsell.gc.ca",
];

function hostOf(url: URL): string {
  return url.hostname.toLowerCase();
}

/**
 * Extract a likely SEAO notice / avis number from a URL or query string.
 * SEAO public links typically embed a numeric avis id (e.g. ?id=123456 or
 * /avis/123456). Returns null when none is found.
 */
function extractSeaoId(url: URL): string | null {
  const q = url.searchParams.get("id") ?? url.searchParams.get("avis") ?? url.searchParams.get("Av");
  if (q && /^\d{3,}$/.test(q)) return q;
  const m = url.pathname.match(/\/(?:avis|notice|item)\/(\d{3,})/i);
  if (m) return m[1];
  return null;
}

/** Extract a CanadaBuys reference / solicitation number token. */
function extractCanadaBuysId(url: URL): string | null {
  const q =
    url.searchParams.get("ref") ??
    url.searchParams.get("id") ??
    url.searchParams.get("solicitation");
  if (q && q.trim().length >= 3) return q.trim();
  const m = url.pathname.match(/\/(?:tender-notices|opportunities)\/([^/?#]+)/i);
  if (m) return decodeURIComponent(m[1]);
  return null;
}

export function parseTriageLink(raw: string): ParsedTriageLink {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return {
      source: "unknown",
      sourceId: null,
      sourceLabel: "Unknown",
      host: "",
      looksLikeOpportunity: false,
      resolvable: false,
    };
  }

  const host = hostOf(url);

  if (SEAO_HOSTS.some((h) => host === h)) {
    const id = extractSeaoId(url);
    return {
      source: "seao",
      sourceId: id,
      sourceLabel: "SEAO",
      host,
      looksLikeOpportunity: Boolean(id) || /avis|notice|recherche/i.test(url.pathname + url.search),
      resolvable: Boolean(id),
    };
  }

  if (CANADABUYS_HOSTS.some((h) => host === h || host.endsWith(".canada.ca"))) {
    const id = extractCanadaBuysId(url);
    return {
      source: "canadabuys",
      sourceId: id,
      sourceLabel: "CanadaBuys",
      host,
      looksLikeOpportunity: Boolean(id) || /tender|opportunit|appel/i.test(url.pathname + url.search),
      resolvable: Boolean(id),
    };
  }

  // Municipal: a .quebec.ca, gouv.qc.ca city, or ville.* host that is not SEAO.
  const isMunicipal =
    /ville\./i.test(host) ||
    /\.quebec\.ca$/i.test(host) ||
    /\.qc\.ca$/i.test(host) ||
    /municipal|appels?-?d-?offres|soumission/i.test(url.pathname);
  if (isMunicipal) {
    const id = url.searchParams.get("id");
    return {
      source: "municipal",
      sourceId: id,
      sourceLabel: "Municipal",
      host,
      looksLikeOpportunity: true,
      resolvable: false, // municipal HTML tenders are not auto-indexed today.
    };
  }

  return {
    source: "unknown",
    sourceId: null,
    sourceLabel: "Unknown",
    host,
    looksLikeOpportunity: false,
    resolvable: false,
  };
}
