import { fetchRecentSeaoJsonUrls, fetchJson } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type SeaoAmendmentRecord = {
  externalId: string;
  contractId?: string;
  tenderExternalId?: string;
  title?: string;
  amendmentType?: string;
  amount?: number;
  amendedAt?: Date;
  sourceUrl: string;
};

export type CompletedContractRecord = {
  externalId: string;
  title?: string;
  winnerName?: string;
  buyerName?: string;
  awardAmount?: number;
  finalValue?: number;
  contractStatus?: string;
  unspsc?: string;
  category?: string;
  region?: string;
  awardDate?: Date;
  sourceUrl: string;
};

type OcdsRelease = {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[];
  buyer?: { name?: string };
  parties?: { name?: string; roles?: string[]; address?: { region?: string } }[];
  contracts?: {
    id?: string;
    awardID?: string;
    title?: string;
    status?: string;
    dateSigned?: string;
    value?: { amount?: number };
    amendments?: { id?: string; date?: string; description?: string; value?: { amount?: number } }[];
  }[];
  awards?: { id?: string }[];
  tender?: { id?: string; title?: string; mainProcurementCategory?: string };
};

type OcdsBundle = { releases?: OcdsRelease[] };

async function loadSeaoBundles(): Promise<OcdsBundle[]> {
  const urls = await fetchRecentSeaoJsonUrls(3);
  const bundles: OcdsBundle[] = [];
  for (const url of urls) {
    const data = await fetchJson<OcdsBundle>(url);
    if (data) bundles.push(data);
  }
  return bundles;
}

export async function fetchSeaoAmendments(limit?: number): Promise<SeaoAmendmentRecord[]> {
  const cap = limit ?? 500;
  const bundles = await loadSeaoBundles();
  const seen = new Set<string>();
  const results: SeaoAmendmentRecord[] = [];

  for (const bundle of bundles) {
    for (const release of bundle.releases ?? []) {
      for (const contract of release.contracts ?? []) {
        for (const amendment of contract.amendments ?? []) {
          const externalId =
            amendment.id || `${contract.id}-amend-${amendment.date}` || "";
          if (!externalId || seen.has(externalId)) continue;
          seen.add(externalId);
          results.push({
            externalId,
            contractId: contract.id,
            tenderExternalId: release.tender?.id || release.ocid,
            title: amendment.description || contract.title,
            amendmentType: "amendment",
            amount: amendment.value?.amount,
            amendedAt: amendment.date ? new Date(amendment.date) : undefined,
            sourceUrl: DATASETS.awards.sourceUrl,
          });
          if (results.length >= cap) return results;
        }
      }
    }
  }

  return results;
}

export async function fetchCompletedContracts(
  limit?: number
): Promise<CompletedContractRecord[]> {
  const cap = limit ?? getSyncLimit("awards");
  const bundles = await loadSeaoBundles();
  const seen = new Set<string>();
  const results: CompletedContractRecord[] = [];

  for (const bundle of bundles) {
    for (const release of bundle.releases ?? []) {
      const isContract =
        release.tag?.includes("contract") ||
        release.tag?.includes("compiled");
      if (!isContract && !release.contracts?.length) continue;

      for (const contract of release.contracts ?? []) {
        const externalId = contract.id || `${release.ocid}-contract`;
        if (!externalId || seen.has(externalId)) continue;
        seen.add(externalId);

        const buyer =
          release.buyer?.name ||
          release.parties?.find((p) => p.roles?.includes("buyer"))?.name;

        results.push({
          externalId,
          title: contract.title || release.tender?.title,
          buyerName: buyer,
          awardAmount: contract.value?.amount,
          finalValue: contract.value?.amount,
          contractStatus: contract.status || "completed",
          category: release.tender?.mainProcurementCategory,
          region:
            release.parties?.find((p) => p.roles?.includes("buyer"))?.address
              ?.region || "Québec",
          awardDate: contract.dateSigned ? new Date(contract.dateSigned) : undefined,
          sourceUrl: DATASETS.awards.sourceUrl,
        });

        if (results.length >= cap) return results;
      }
    }
  }

  return results;
}
