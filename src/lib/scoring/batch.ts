import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getIntelligenceForPermit } from "@/lib/intelligence";
import type { PropertyIntelligence } from "@/lib/intelligence";

type PermitRow = {
  permitType: string;
  workType?: string | null;
  borough?: string | null;
  address: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  matricule?: string | null;
};

function competitionKey(permitType: string, borough?: string | null): string {
  const prefix = permitType.slice(0, 8).toLowerCase();
  return `${borough ?? "_"}:${prefix}`;
}

/** Batch competition counts for a set of permits with one grouped query. */
export async function batchCompetitionCounts(
  permits: { permitType: string; borough?: string | null }[],
  days = 90
): Promise<Map<string, number>> {
  const since = subDays(new Date(), days);
  const boroughs = [...new Set(permits.map((p) => p.borough).filter(Boolean))] as string[];
  const map = new Map<string, number>();

  if (boroughs.length === 0) {
    const total = await prisma.permit.count({ where: { issueDate: { gte: since } } });
    map.set("_:_", total);
    return map;
  }

  const rows = await prisma.permit.groupBy({
    by: ["borough", "permitType"],
    where: { issueDate: { gte: since }, borough: { in: boroughs } },
    _count: { _all: true },
  });
  for (const row of rows) {
    map.set(competitionKey(row.permitType, row.borough), row._count._all);
  }

  return map;
}

export function getCompetitionFromMap(
  map: Map<string, number>,
  permitType: string,
  borough?: string | null
): number {
  return map.get(competitionKey(permitType, borough)) ?? map.get("_:_") ?? 0;
}

export function createIntelligenceCache() {
  const cache = new Map<string, PropertyIntelligence | undefined>();

  return async function getCachedIntelligence(
    permit: PermitRow
  ): Promise<PropertyIntelligence | undefined> {
    const key =
      permit.matricule ??
      `${permit.latitude ?? ""}:${permit.longitude ?? ""}:${permit.address}:${permit.city ?? ""}`;
    if (cache.has(key)) return cache.get(key);
    const intel = await getIntelligenceForPermit(permit);
    cache.set(key, intel);
    return intel;
  };
}
