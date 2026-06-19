import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { HIGH_VALUE_THRESHOLD, formatCad } from "@/lib/format-cad";
import { fetchMarketPulseStats } from "@/lib/market-pulse";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

function anonymizeAddress(address: string, borough?: string | null): string {
  const parts = address.split(/[\s,]+/).filter(Boolean);
  const streetNum = parts[0]?.match(/^\d+/) ? parts[0] : "***";
  return `${streetNum} · ${borough ?? "Montréal"}`;
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:stats:preview:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  ensureFreshForKey("stats");
  const since = subDays(new Date(), 14);

  const [permits, tenders, stats] = await Promise.all([
    prisma.permit.findMany({
      where: {
        issueDate: { gte: since },
        estimatedCost: { gte: HIGH_VALUE_THRESHOLD },
      },
      orderBy: { estimatedCost: "desc" },
      take: 3,
      select: {
        id: true,
        permitType: true,
        address: true,
        borough: true,
        estimatedCost: true,
      },
    }),
    prisma.tender.findMany({
      where: {
        closesAt: { gte: new Date() },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
      orderBy: { closesAt: "asc" },
      take: 2,
      select: { id: true, title: true, organization: true, closesAt: true },
    }),
    fetchMarketPulseStats(),
  ]);

  const leads = [
    ...permits.map((p) => ({
      id: p.id,
      kind: "permit" as const,
      label: anonymizeAddress(p.address, p.borough),
      borough: p.borough,
      score: Math.min(99, 72 + Math.floor((p.estimatedCost ?? 0) / 1_000_000) * 3),
      valueLabel: p.estimatedCost ? formatCad(p.estimatedCost, "fr") : undefined,
      signal: "RBQ-Fit · Haute valeur",
    })),
    ...tenders.map((t) => ({
      id: t.id,
      kind: "tender" as const,
      label: (t.title.length > 48 ? `${t.title.slice(0, 45)}…` : t.title) || "Appel SEAO",
      borough: t.organization,
      score: 78,
      signal: "Échéance jeudi",
    })),
  ].slice(0, 3);

  return NextResponse.json({
    leads,
    stats: {
      permitsWeek: stats.permitsWeek,
      highValueWeek: stats.highValueWeek,
      estimatedValueWeek: stats.estimatedValueWeek,
    },
  });
}
