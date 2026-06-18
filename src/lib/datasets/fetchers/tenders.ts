import { fetchRecentSeaoBundles, fetchJson } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type TenderRecord = {
  externalId: string;
  title: string;
  organization?: string;
  category?: string;
  region?: string;
  estimatedValue?: number;
  publishedAt?: Date;
  closesAt?: Date;
  summary?: string;
  description?: string;
  requiresAmp?: boolean;
  sourceUrl: string;
  unspsc?: string;
  status?: string;
};

type OcdsRelease = {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[];
  buyer?: { name?: string };
  parties?: { name?: string; roles?: string[]; address?: { region?: string } }[];
  tender?: {
    id?: string;
    title?: string;
    status?: string;
    mainProcurementCategory?: string;
    procurementMethodDetails?: string;
    tenderPeriod?: { startDate?: string; endDate?: string };
    items?: {
      description?: string;
      classification?: { id?: string; description?: string };
    }[];
    documents?: { url?: string }[];
  };
};

type OcdsBundle = { releases?: OcdsRelease[] };

function parseRelease(release: OcdsRelease, now: number): TenderRecord | null {
  if (!release.tender?.title) return null;
  const isTender =
    release.tag?.includes("tender") ||
    release.tender.status === "active" ||
    release.tender.status === "planned";
  if (!isTender) return null;

  const closesAt = release.tender.tenderPeriod?.endDate
    ? new Date(release.tender.tenderPeriod.endDate)
    : undefined;
  if (closesAt && closesAt.getTime() < now - 7 * 86400000) return null;

  const buyer =
    release.buyer?.name ||
    release.parties?.find((p) => p.roles?.includes("buyer"))?.name;
  const region =
    release.parties?.find((p) => p.roles?.includes("buyer"))?.address?.region ||
    "Québec";
  const item = release.tender.items?.[0];
  const unspsc = item?.classification?.id;
  const docUrl = release.tender.documents?.[0]?.url;
  const titleLower = release.tender.title.toLowerCase();
  const descLower = (item?.description ?? "").toLowerCase();
  const requiresAmp =
    titleLower.includes("amp") ||
    descLower.includes("autorisation de mise en marché") ||
    descLower.includes("amp ");
  const externalId =
    release.tender.id || release.ocid || release.id || "";

  if (!externalId) return null;

  return {
    externalId,
    title: release.tender.title,
    organization: buyer,
    category:
      release.tender.mainProcurementCategory ||
      release.tender.procurementMethodDetails,
    region,
    publishedAt: release.tender.tenderPeriod?.startDate
      ? new Date(release.tender.tenderPeriod.startDate)
      : release.date
        ? new Date(release.date)
        : undefined,
    closesAt,
    summary: item?.description || item?.classification?.description,
    description: item?.description || item?.classification?.description,
    requiresAmp,
    sourceUrl: docUrl || DATASETS.tenders.sourceUrl,
    unspsc,
    status: release.tender.status,
  };
}

export async function fetchTenders(
  limit?: number,
  options?: { sinceBundle?: string | null }
): Promise<{ records: TenderRecord[]; latestBundle: string | null }> {
  const cap = limit ?? getSyncLimit("tenders");
  const bundles = await fetchRecentSeaoBundles(5);
  if (bundles.length === 0) return { records: [], latestBundle: null };

  const since = options?.sinceBundle;
  const toProcess = since
    ? bundles.filter((b) => b.name.localeCompare(since) > 0)
    : bundles;

  const seen = new Set<string>();
  const results: TenderRecord[] = [];
  const now = Date.now();

  for (const bundle of toProcess.length > 0 ? toProcess : bundles.slice(0, 1)) {
    const data = await fetchJson<OcdsBundle>(bundle.url);
    if (!data?.releases) continue;

    for (const release of data.releases) {
      const record = parseRelease(release, now);
      if (!record || seen.has(record.externalId)) continue;
      seen.add(record.externalId);
      results.push(record);
      if (results.length >= cap) {
        return { records: results, latestBundle: bundle.name };
      }
    }
  }

  return {
    records: results,
    latestBundle: bundles[0]?.name ?? null,
  };
}
