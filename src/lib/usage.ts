import { startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@/generated/prisma/client";

export async function incrementUsage(
  userId: string,
  key: string,
  amount = 1
): Promise<number> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const row = await prisma.usageCounter.upsert({
    where: { userId_key_weekStart: { userId, key, weekStart } },
    create: { userId, key, weekStart, count: amount },
    update: { count: { increment: amount } },
  });
  return row.count;
}

export async function getUsage(userId: string, key: string): Promise<number> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const row = await prisma.usageCounter.findUnique({
    where: { userId_key_weekStart: { userId, key, weekStart } },
  });
  return row?.count ?? 0;
}

export function parseJsonArray(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export function matchesEssentielProfile(
  plan: Plan | null | undefined,
  userTrades: string[],
  userRegions: string[],
  item: { trade?: string; region?: string; borough?: string; title?: string }
): boolean {
  if (plan !== "ESSENTIEL") return true;

  const trades = userTrades.map((t) => t.toLowerCase()).filter(Boolean);
  const regions = userRegions.map((r) => r.toLowerCase()).filter(Boolean);
  if (trades.length === 0 && regions.length === 0) return true;

  const haystack = `${item.trade ?? ""} ${item.title ?? ""} ${item.region ?? ""} ${item.borough ?? ""}`.toLowerCase();

  const tradeMatch = trades.length === 0 || trades.some((t) => haystack.includes(t));
  const regionMatch = regions.length === 0 || regions.some((r) => haystack.includes(r));
  return tradeMatch && regionMatch;
}

export async function canViewTenderMatch(plan: Plan | null | undefined, userId: string): Promise<boolean> {
  if (plan !== "ESSENTIEL") return true;
  const used = await getUsage(userId, "seao_matches");
  return used < 5;
}
