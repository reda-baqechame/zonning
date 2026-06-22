/**
 * Incumbent intelligence — "who won this category before, how often, and at
 * what price (including cost overruns)" — computed from ZONNING's SEAO award
 * history. Drives win-probability (competition + dominance) and the
 * marchés-qc UI's incumbent panel.
 */
import { prisma } from "@/lib/prisma";

export type Incumbent = {
  name: string;
  wins: number;
  avgAmount: number | null;
  avgOverrunPct: number | null;
};

export type IncumbentIntelligence = {
  totalAwards: number;
  distinctWinners: number;
  /** Share (0–1) of awards held by the single top incumbent. */
  dominance: number;
  topIncumbents: Incumbent[];
};

const EMPTY: IncumbentIntelligence = {
  totalAwards: 0,
  distinctWinners: 0,
  dominance: 0,
  topIncumbents: [],
};

export async function getIncumbentIntelligence(
  unspsc?: string | null,
  category?: string | null,
  region?: string | null,
): Promise<IncumbentIntelligence> {
  const or: Record<string, unknown>[] = [];
  if (unspsc) or.push({ unspsc });
  if (category) or.push({ category });
  if (or.length === 0) return EMPTY;

  const awards = await prisma.tenderAward.findMany({
    where: {
      OR: or,
      ...(region ? { region } : {}),
      winnerName: { not: null },
    },
    select: { winnerName: true, awardAmount: true, finalValue: true },
    take: 500,
  });

  return aggregateIncumbents(awards);
}

/** Pure aggregation — separated for testability. */
export function aggregateIncumbents(
  awards: { winnerName: string | null; awardAmount: number | null; finalValue: number | null }[],
): IncumbentIntelligence {
  if (awards.length === 0) return EMPTY;

  const byWinner = new Map<string, { wins: number; amountSum: number; amountN: number; overrunSum: number; overrunN: number }>();

  for (const a of awards) {
    if (!a.winnerName) continue;
    const cur = byWinner.get(a.winnerName) ?? { wins: 0, amountSum: 0, amountN: 0, overrunSum: 0, overrunN: 0 };
    cur.wins += 1;
    if (a.awardAmount != null) {
      cur.amountSum += a.awardAmount;
      cur.amountN += 1;
      if (a.finalValue != null && a.awardAmount > 0) {
        cur.overrunSum += (a.finalValue - a.awardAmount) / a.awardAmount;
        cur.overrunN += 1;
      }
    }
    byWinner.set(a.winnerName, cur);
  }

  const totalAwards = awards.filter((a) => a.winnerName).length;
  const distinctWinners = byWinner.size;

  const topIncumbents: Incumbent[] = [...byWinner.entries()]
    .map(([name, s]) => ({
      name,
      wins: s.wins,
      avgAmount: s.amountN > 0 ? Math.round(s.amountSum / s.amountN) : null,
      avgOverrunPct: s.overrunN > 0 ? Math.round((s.overrunSum / s.overrunN) * 1000) / 10 : null,
    }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5);

  const dominance = totalAwards > 0 ? (topIncumbents[0]?.wins ?? 0) / totalAwards : 0;

  return { totalAwards, distinctWinners, dominance, topIncumbents };
}
