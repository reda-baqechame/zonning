import { NextRequest, NextResponse } from "next/server";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [verdictViews, sharedWithReferrer, payingAccounts] = await Promise.all([
    prisma.verdictReport.aggregate({ _sum: { viewCount: true } }),
    prisma.verdictReport.count({ where: { referrer: { not: null } } }),
    prisma.user.count({
      where: { plan: { in: ["ESSENTIEL", "PRO", "EQUIPE"] } },
    }),
  ]);

  const recentViews = await prisma.verdictReport.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { viewCount: true },
  });

  await prisma.syncLog.create({
    data: {
      source: "cron-stats",
      status: "ok",
      recordsProcessed: verdictViews._sum.viewCount ?? 0,
      error: JSON.stringify({
        totalVerdictViews: verdictViews._sum.viewCount ?? 0,
        viewsLast24h: recentViews._sum.viewCount ?? 0,
        sharedWithReferrer,
        payingAccounts,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    totalVerdictViews: verdictViews._sum.viewCount ?? 0,
    viewsLast24h: recentViews._sum.viewCount ?? 0,
    sharedWithReferrer,
    payingAccounts,
    loggedAt: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
