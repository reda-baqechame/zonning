import { fetchRecentSeaoJsonUrls, fetchJson } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type AwardRecord = {
  externalId: string;
  title?: string;
  winnerName?: string;
  buyerName?: string;
  awardAmount?: number;
  unspsc?: string;
  category?: string;
  region?: string;
  awardDate?: Date;
  sourceUrl: string;
};

type OcdsAward = {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[];
  buyer?: { name?: string };
  parties?: {
    name?: string;
    roles?: string[];
    address?: { region?: string };
  }[];
  awards?: {
    id?: string;
    title?: string;
    status?: string;
    date?: string;
    value?: { amount?: number };
    suppliers?: { name?: string }[];
    items?: {
      classification?: { id?: string; description?: string };
    }[];
  }[];
  tender?: { title?: string; mainProcurementCategory?: string };
};

type OcdsBundle = { releases?: OcdsAward[] };

export async function fetchAwards(limit?: number): Promise<AwardRecord[]> {
  const cap = limit ?? getSyncLimit("awards");
  const resourceUrls = await fetchRecentSeaoJsonUrls(3);
  const seen = new Set<string>();
  const results: AwardRecord[] = [];

  for (const resourceUrl of resourceUrls) {
    const data = await fetchJson<OcdsBundle>(resourceUrl);
    if (!data?.releases) continue;

    for (const release of data.releases) {
      if (!release.tag?.includes("award") && !release.awards?.length) continue;

      for (const award of release.awards ?? []) {
        const externalId =
          award.id || `${release.ocid}-${award.title}` || release.id || "";
        if (!externalId || seen.has(externalId)) continue;
        seen.add(externalId);

        const winner =
          award.suppliers?.[0]?.name ||
          release.parties?.find((p) => p.roles?.includes("supplier"))?.name;
        const buyer =
          release.buyer?.name ||
          release.parties?.find((p) => p.roles?.includes("buyer"))?.name;
        const item = award.items?.[0];

        results.push({
          externalId,
          title: award.title || release.tender?.title,
          winnerName: winner,
          buyerName: buyer,
          awardAmount: award.value?.amount,
          unspsc: item?.classification?.id,
          category: release.tender?.mainProcurementCategory,
          region:
            release.parties?.find((p) => p.roles?.includes("buyer"))?.address
              ?.region || "Québec",
          awardDate: award.date ? new Date(award.date) : release.date ? new Date(release.date) : undefined,
          sourceUrl: DATASETS.awards.sourceUrl,
        });

        if (results.length >= cap) return results;
      }
    }
  }

  return results;
}

export async function getSimilarAwards(unspsc?: string | null, category?: string | null, limit = 3) {
  if (!unspsc && !category) return [];

  const { prisma } = await import("@/lib/prisma");
  const awards = await prisma.tenderAward.findMany({
    where: {
      OR: [
        ...(unspsc ? [{ unspsc }] : []),
        ...(category ? [{ category: { contains: category } }] : []),
      ],
    },
    orderBy: { awardDate: "desc" },
    take: limit,
  });

  return Promise.all(
    awards.map(async (a) => {
      const needle = a.winnerName?.slice(0, 24);
      const company = needle
        ? await prisma.company.findFirst({
            where: {
              OR: [
                { name: { contains: needle } },
                ...(needle.length >= 6 ? [{ neq: { contains: needle } }] : []),
              ],
            },
            select: { id: true, neq: true, name: true },
          })
        : null;
      return {
        ...a,
        companyId: company?.id ?? null,
        companyNeq: company?.neq ?? null,
        companyName: company?.name ?? a.winnerName,
      };
    })
  );
}
