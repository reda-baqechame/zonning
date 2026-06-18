import { fetchJson, fetchText, type CkanResource } from "../client";

const MONTREAL_CKAN_BASE = "https://donnees.montreal.ca/api/3/action";

export async function fetchMontrealCkanPackage(
  datasetId: string
): Promise<{ resources: CkanResource[]; url: string } | null> {
  const res = await fetch(`${MONTREAL_CKAN_BASE}/package_show?id=${datasetId}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    result?: { resources?: CkanResource[]; url?: string };
  };

  return {
    resources: data.result?.resources ?? [],
    url: data.result?.url ?? `https://donnees.montreal.ca/dataset/${datasetId}`,
  };
}

export async function fetchMontrealCkanResourceUrl(
  datasetId: string,
  preferredFormat: string | string[] = "GeoJSON"
): Promise<string | null> {
  const pkg = await fetchMontrealCkanPackage(datasetId);
  if (!pkg) return null;

  const formats = Array.isArray(preferredFormat)
    ? preferredFormat.map((f) => f.toUpperCase())
    : [preferredFormat.toUpperCase()];

  for (const fmt of formats) {
    const matches = pkg.resources.filter(
      (r) =>
        r.format?.toUpperCase() === fmt ||
        r.url?.toLowerCase().includes(fmt.toLowerCase()) ||
        r.url?.toLowerCase().endsWith(`.${fmt.toLowerCase()}`)
    );
    const geojson = matches.find((r) => r.url?.toLowerCase().includes("geojson"));
    if (geojson?.url) return geojson.url;
    if (matches[0]?.url) return matches[0].url;
  }

  return pkg.resources[0]?.url ?? null;
}

/** Wraps donnees.montreal.ca CKAN resource resolution. */
export class MontrealCkanAdapter {
  async getResourceUrl(
    ckanId: string,
    preferredFormat: string | string[]
  ): Promise<string | null> {
    return fetchMontrealCkanResourceUrl(ckanId, preferredFormat);
  }

  async fetchJson<T>(url: string): Promise<T | null> {
    return fetchJson<T>(url);
  }

  async fetchText(url: string, maxBytes?: number): Promise<string | null> {
    return fetchText(url, maxBytes);
  }
}

export const montrealCkan = new MontrealCkanAdapter();
