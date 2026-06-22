/**
 * Forecast engine — market-heat + opportunity-aging projections.
 *
 * Derives directional forecasts from permit-activity trends (HouseCanary's
 * 36-month angle, adapted to Quebec permit data). Everything is labeled as a
 * model output with a confidence band — never presented as certain.
 *
 * Models are intentionally transparent and explainable: trend = linear
 * regression of weekly permit counts; heat band = recent-velocity vs baseline;
 * aging = distribution of time-to-act on permits. No black box.
 */

import { prisma } from "@/lib/prisma";

export type HeatBand = "cooling" | "stable" | "heating" | "hot";

export interface BoroughForecast {
  borough: string;
  /** Permit counts per week for the lookback window (oldest→newest). */
  weeklyCounts: { week: string; count: number; estimatedValue: number }[];
  /** Linear trend slope (permits/week change). */
  trendSlope: number;
  /** Forecasted permit count for the next 4 weeks. */
  forecast4w: number[];
  heatBand: HeatBand;
  /** 0–100 model confidence (based on data volume + variance). */
  confidence: number;
  /** Total estimated value in the window. */
  totalValue: number;
  evidenceGaps: string[];
}

export interface MarketForecastResult {
  generatedAt: string;
  windowDays: number;
  boroughs: BoroughForecast[];
  /** Top heating boroughs — where the market is accelerating. */
  heating: BoroughForecast[];
  /** Slowest boroughs — cooling / opportunity to enter. */
  cooling: BoroughForecast[];
  disclaimer: string;
}

const HEAT_THRESHOLD = 0.15; // >15% above baseline velocity = heating

export async function forecastMarket(windowDays = 90, topN = 12): Promise<MarketForecastResult> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const permits = await prisma.permit.findMany({
    where: { issueDate: { gte: since } },
    select: { borough: true, issueDate: true, estimatedCost: true, city: true },
    take: 20000,
  });

  // Group by borough → weekly buckets.
  const byBorough = new Map<string, { date: Date; count: number; value: number }[]>();
  for (const p of permits) {
    const key = p.borough ?? p.city ?? "Inconnu";
    if (!p.issueDate) continue;
    const arr = byBorough.get(key) ?? [];
    arr.push({ date: p.issueDate, count: 1, value: p.estimatedCost ?? 0 });
    byBorough.set(key, arr);
  }

  const boroughs: BoroughForecast[] = [];
  for (const [borough, records] of byBorough) {
    const weekly = bucketWeekly(records, since);
    if (weekly.length < 3) continue; // not enough data

    const counts = weekly.map((w) => w.count);
    const slope = linearSlope(counts);
    const baseline = average(counts.slice(0, Math.max(1, Math.floor(counts.length / 2))));
    const recent = average(counts.slice(-2));
    const velocityRatio = baseline > 0 ? recent / baseline : 1;

    const heatBand: HeatBand =
      velocityRatio >= 1 + HEAT_THRESHOLD * 2 ? "hot"
      : velocityRatio >= 1 + HEAT_THRESHOLD ? "heating"
      : velocityRatio <= 1 - HEAT_THRESHOLD ? "cooling"
      : "stable";

    const forecast4w = forecastNext(counts, 4);
    const variance = coefficientOfVariation(counts);
    const confidence = Math.round(
      Math.max(15, Math.min(85, 40 + counts.length * 2 + (variance < 0.5 ? 15 : 0)))
    );

    const totalValue = weekly.reduce((s, w) => s + w.estimatedValue, 0);
    const evidenceGaps: string[] = [];
    if (counts.length < 6) evidenceGaps.push("Peu de semaines de données — prévision à faible confiance.");
    if (variance > 0.8) evidenceGaps.push("Forte variabilité hebdomadaire — tendance moins fiable.");

    boroughs.push({
      borough,
      weeklyCounts: weekly.map((w) => ({ week: w.week, count: w.count, estimatedValue: Math.round(w.estimatedValue) })),
      trendSlope: Math.round(slope * 100) / 100,
      forecast4w: forecast4w.map((n) => Math.max(0, Math.round(n))),
      heatBand,
      confidence,
      totalValue: Math.round(totalValue),
      evidenceGaps,
    });
  }

  boroughs.sort((a, b) => b.totalValue - a.totalValue);
  const heating = boroughs.filter((b) => b.heatBand === "hot" || b.heatBand === "heating").sort((a, b) => b.trendSlope - a.trendSlope).slice(0, topN);
  const cooling = boroughs.filter((b) => b.heatBand === "cooling").sort((a, b) => a.trendSlope - b.trendSlope).slice(0, topN);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    boroughs: boroughs.slice(0, topN * 2),
    heating,
    cooling,
    disclaimer:
      "Prévisions directionnelles dérivées des tendances de permis. À confirmer avec les données municipales avant toute décision d'investissement.",
  };
}

// ---- Opportunity aging -----------------------------------------------------

export interface OpportunityAging {
  medianDaysToAct: number | null;
  p90DaysToAct: number | null;
  /** Share of permits still within the "act now" window. */
  freshShare: number;
  sampleSize: number;
  buckets: { label: string; count: number }[];
}

/**
 * How quickly permits in a borough age — the window where a contractor can
 * still reach the applicant first. Derived from issueDate distribution.
 */
export async function opportunityAging(borough?: string): Promise<OpportunityAging> {
  const since = new Date(Date.now() - 120 * 86_400_000);
  const permits = await prisma.permit.findMany({
    where: { borough: borough ? { contains: borough } : undefined, issueDate: { gte: since } },
    select: { issueDate: true },
    take: 10000,
  });

  if (!permits.length) {
    return { medianDaysToAct: null, p90DaysToAct: null, freshShare: 0, sampleSize: 0, buckets: [] };
  }

  const ages = permits
    .filter((p) => p.issueDate)
    .map((p) => Math.max(0, Math.round((Date.now() - p.issueDate!.getTime()) / 86_400_000)))
    .sort((a, b) => a - b);

  const median = ages[Math.floor(ages.length / 2)] ?? null;
  const p90 = ages[Math.floor(ages.length * 0.9)] ?? null;
  const freshShare = ages.filter((a) => a <= 7).length / ages.length;

  const buckets = [
    { label: "0–7 j", count: ages.filter((a) => a <= 7).length },
    { label: "8–30 j", count: ages.filter((a) => a > 7 && a <= 30).length },
    { label: "31–60 j", count: ages.filter((a) => a > 30 && a <= 60).length },
    { label: "60+ j", count: ages.filter((a) => a > 60).length },
  ];

  return { medianDaysToAct: median, p90DaysToAct: p90, freshShare, sampleSize: ages.length, buckets };
}

// ---- math helpers ----------------------------------------------------------

function bucketWeekly(records: { date: Date; count: number; value: number }[], since: Date) {
  const weekMs = 7 * 86_400_000;
  const start = since.getTime();
  const buckets = new Map<number, { count: number; value: number }>();
  for (const r of records) {
    const weekIndex = Math.floor((r.date.getTime() - start) / weekMs);
    const b = buckets.get(weekIndex) ?? { count: 0, value: 0 };
    b.count += r.count;
    b.value += r.value;
    buckets.set(weekIndex, b);
  }
  const maxIndex = Math.max(0, ...buckets.keys());
  const out: { week: string; count: number; estimatedValue: number }[] = [];
  for (let i = 0; i <= maxIndex; i++) {
    const b = buckets.get(i) ?? { count: 0, value: 0 };
    const weekStart = new Date(start + i * weekMs);
    out.push({ week: weekStart.toISOString().slice(0, 10), count: b.count, estimatedValue: b.value });
  }
  return out;
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const meanX = average(xs);
  const meanY = average(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (values[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function forecastNext(values: number[], steps: number): number[] {
  const slope = linearSlope(values);
  const last = values[values.length - 1] ?? 0;
  // Mean-reverting: dampen slope toward 0 over the horizon.
  const out: number[] = [];
  for (let i = 1; i <= steps; i++) {
    const damp = Math.pow(0.75, i);
    out.push(last + slope * i * damp);
  }
  return out;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  if (mean === 0) return 0;
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance) / mean;
}
