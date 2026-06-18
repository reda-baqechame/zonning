import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { subDays } from "date-fns";
import { enforceRateLimit } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:digest", 30, 60_000);
  if (limited) return limited;

  ensureFreshForKey("digest");
  const weekAgo = subDays(new Date(), 7);

  const [permitsWeek, tendersOpen, companies] = await Promise.all([
    prisma.permit.count({ where: { issueDate: { gte: weekAgo } } }),
    prisma.tender.count({ where: { closesAt: { gte: new Date() } } }),
    prisma.company.count(),
  ]);

  return NextResponse.json({
    digest: {
      permitsWeek,
      tendersOpen,
      companies,
      generatedAt: new Date().toISOString(),
    },
  });
}
