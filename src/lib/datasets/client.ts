import { politeFetchWithRetry } from "@/lib/http/polite-fetch";
import { dataWarn } from "@/lib/datasets/log";

const CKAN_BASES = {
  quebec: "https://www.donneesquebec.ca/recherche/api/3/action",
  montreal: "https://donnees.montreal.ca/api/3/action",
} as const;

export type CkanHost = keyof typeof CKAN_BASES;

export type CkanResource = {
  id: string;
  url: string;
  format: string;
  name?: string;
  last_modified?: string;
};

export async function fetchCkanPackage(
  datasetId: string,
  host: CkanHost = "quebec"
): Promise<{ resources: CkanResource[]; url: string } | null> {
  const base = CKAN_BASES[host];
  const res = await politeFetchWithRetry(`${base}/package_show?id=${datasetId}`);
  if (!res.ok) {
    dataWarn("fetchCkanPackage", { datasetId, host, status: res.status });
    return null;
  }

  const data = (await res.json()) as {
    result?: { resources?: CkanResource[]; url?: string };
  };

  return {
    resources: data.result?.resources ?? [],
    url: data.result?.url ?? (
      host === "montreal"
        ? `https://donnees.montreal.ca/dataset/${datasetId}`
        : `https://www.donneesquebec.ca/recherche/dataset/${datasetId}`
    ),
  };
}

export async function fetchCkanResourceUrl(
  datasetId: string,
  preferredFormat: string | string[] = "CSV",
  host: CkanHost = "quebec"
): Promise<string | null> {
  const pkg = await fetchCkanPackage(datasetId, host);
  if (!pkg) return null;

  const formats = Array.isArray(preferredFormat)
    ? preferredFormat.map((f) => f.toUpperCase())
    : [preferredFormat.toUpperCase()];

  for (const fmt of formats) {
    const matches = pkg.resources.filter(
      (r) =>
        r.format?.toUpperCase() === fmt ||
        r.url?.toLowerCase().endsWith(`.${fmt.toLowerCase()}`)
    );
    const preferred = matches.find(
      (r) =>
        r.url?.includes("uniteevaluation") ||
        r.url?.includes("evaluationfonciere") ||
        r.url?.includes("listefournisseurs") ||
        r.url?.includes("transactions") ||
        r.name?.toLowerCase().includes("principal")
    );
    if (preferred?.url) return preferred.url;
    if (matches[0]?.url) return matches[0].url;
  }

  return pkg.resources[0]?.url ?? null;
}

export async function fetchCkanDatastoreTotal(
  resourceId: string,
  host: CkanHost = "quebec"
): Promise<number | null> {
  const base = CKAN_BASES[host];
  const res = await politeFetchWithRetry(
    `${base}/datastore_search?resource_id=${resourceId}&limit=0`
  );
  if (!res.ok) {
    dataWarn("fetchCkanDatastoreTotal", { resourceId, host, status: res.status });
    return null;
  }
  const data = (await res.json()) as { result?: { total?: number } };
  const total = data.result?.total;
  return typeof total === "number" && total > 0 ? total : null;
}

export async function fetchRecentSeaoJsonUrls(count = 3): Promise<string[]> {
  const bundles = await fetchRecentSeaoBundles(count);
  return bundles.map((b) => b.url);
}

export type SeaoBundle = { name: string; url: string };

export async function fetchRecentSeaoBundles(count = 3): Promise<SeaoBundle[]> {
  const pkg = await fetchCkanPackage("systeme-electronique-dappel-doffres-seao");
  if (!pkg) return [];

  return pkg.resources
    .filter((r) => r.format?.toUpperCase() === "JSON" && r.name?.includes("hebdo"))
    .sort((a, b) => (b.name ?? "").localeCompare(a.name ?? ""))
    .slice(0, count)
    .map((r) => ({ name: r.name ?? r.url, url: r.url }))
    .filter((b) => Boolean(b.url));
}

export async function fetchLatestSeaoJsonUrl(): Promise<string | null> {
  const urls = await fetchRecentSeaoJsonUrls(1);
  return urls[0] ?? null;
}

export async function fetchText(url: string, maxBytes = 15_000_000): Promise<string | null> {
  const res = await politeFetchWithRetry(url, undefined, { timeoutMs: 120_000 });
  if (!res.ok) {
    dataWarn("fetchText", { url, status: res.status });
    return null;
  }

  const buf = await res.arrayBuffer();
  const slice = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
  return new TextDecoder().decode(slice);
}

export async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await politeFetchWithRetry(url);
  if (!res.ok) {
    dataWarn("fetchJson", { url, status: res.status });
    return null;
  }
  return res.json() as Promise<T>;
}

export async function fetchCkanDatastoreSearch(
  resourceId: string,
  limit = 500,
  offset = 0,
  host: CkanHost = "quebec",
  sort?: string
): Promise<Record<string, unknown>[]> {
  const base = CKAN_BASES[host];
  const sortParam = sort ? `&sort=${encodeURIComponent(sort)}` : "";
  const url = `${base}/datastore_search?resource_id=${resourceId}&limit=${limit}&offset=${offset}${sortParam}`;
  const res = await politeFetchWithRetry(url);
  if (!res.ok) {
    dataWarn("fetchCkanDatastoreSearch", { resourceId, host, status: res.status });
    return [];
  }
  const data = (await res.json()) as {
    result?: { records?: Record<string, unknown>[] };
  };
  const records = data.result?.records ?? [];
  if (records.length === 0) {
    dataWarn("fetchCkanDatastoreSearch", { resourceId, host, reason: "empty result" });
  }
  return records;
}

export async function findResourceUrl(
  datasetId: string,
  nameIncludes: string,
  format = "CSV",
  host: CkanHost = "quebec"
): Promise<string | null> {
  const pkg = await fetchCkanPackage(datasetId, host);
  if (!pkg) return null;
  const needle = nameIncludes.toLowerCase();
  const match = pkg.resources.find(
    (r) =>
      r.name?.toLowerCase().includes(needle) &&
      (r.format?.toUpperCase() === format.toUpperCase() ||
        r.url?.toLowerCase().endsWith(`.${format.toLowerCase()}`))
  );
  return match?.url ?? null;
}
