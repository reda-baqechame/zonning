import { fetchRecentSeaoJsonUrls, fetchJson } from "../client";
import { DATASETS, getSyncLimit } from "../registry";
import type { TenderRecord } from "./tenders";

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
    procurementMethod?: string;
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

const STANDING_HINTS = [
  "offre à commandes",
  "offres à commandes",
  "offre a commandes",
  "standing offer",
  "contrat à commandes",
  "contrat-cadre",
  "framework agreement",
];

function isStandingOfferRelease(release: OcdsRelease): boolean {
  const title = (release.tender?.title ?? "").toLowerCase();
  const method = (release.tender?.procurementMethodDetails ?? "").toLowerCase();
  const methodCode = (release.tender?.procurementMethod ?? "").toLowerCase();
  const desc = (release.tender?.items?.[0]?.description ?? "").toLowerCase();
  const haystack = `${title} ${method} ${methodCode} ${desc}`;
  return STANDING_HINTS.some((h) => haystack.includes(h));
}

function parseStandingRelease(release: OcdsRelease): TenderRecord | null {
  if (!release.tender?.title || !isStandingOfferRelease(release)) return null;

  const buyer =
    release.buyer?.name ||
    release.parties?.find((p) => p.roles?.includes("buyer"))?.name;
  const region =
    release.parties?.find((p) => p.roles?.includes("buyer"))?.address?.region ||
    "Québec";
  const item = release.tender.items?.[0];
  const externalId = `standing-${release.tender.id || release.ocid || release.id || ""}`;
  if (!externalId || externalId === "standing-") return null;

  return {
    externalId,
    title: release.tender.title,
    organization: buyer,
    category: release.tender.mainProcurementCategory || "Offre à commandes",
    region,
    publishedAt: release.tender.tenderPeriod?.startDate
      ? new Date(release.tender.tenderPeriod.startDate)
      : release.date
        ? new Date(release.date)
        : undefined,
    closesAt: release.tender.tenderPeriod?.endDate
      ? new Date(release.tender.tenderPeriod.endDate)
      : undefined,
    summary: item?.description || item?.classification?.description,
    description: item?.description,
    requiresAmp: false,
    sourceUrl: release.tender.documents?.[0]?.url || DATASETS["seao-standing-offers"].sourceUrl,
    unspsc: item?.classification?.id,
    status: "standing",
  };
}

export type StandingOffersFetchResult = {
  records: TenderRecord[];
  bundlesFetched: number;
};

export function standingOffersSource(
  recordCount: number,
  bundlesFetched: number,
): "live" | "unchanged" | "empty" {
  if (recordCount > 0) return "live";
  return bundlesFetched > 0 ? "unchanged" : "empty";
}

export async function fetchSeaoStandingOffers(limit?: number): Promise<StandingOffersFetchResult> {
  const cap = limit ?? getSyncLimit("seao-standing-offers");
  const resourceUrls = await fetchRecentSeaoJsonUrls(4);
  const seen = new Set<string>();
  const results: TenderRecord[] = [];
  let bundlesFetched = 0;

  for (const resourceUrl of resourceUrls) {
    const data = await fetchJson<OcdsBundle>(resourceUrl);
    if (!data?.releases) continue;
    bundlesFetched++;

    for (const release of data.releases) {
      const record = parseStandingRelease(release);
      if (!record || seen.has(record.externalId)) continue;
      seen.add(record.externalId);
      results.push(record);
      if (results.length >= cap) return { records: results, bundlesFetched };
    }
  }

  return { records: results, bundlesFetched };
}
