import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { enforceRateLimit } from "@/lib/api-guard";
import { clampQuery } from "@/lib/query-params";

const PROJECT_CITIES = ["Sherbrooke", "Brossard"] as const;

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:development-projects", 60, 60_000);
  if (limited) return limited;

  ensureFreshForKey("intelligence");
  const city = clampQuery(req.nextUrl.searchParams.get("city"), 80);

  const projects = await prisma.developmentProject.findMany({
    where: city ? { city: { contains: city } } : { city: { in: [...PROJECT_CITIES] } },
    orderBy: { sourceFetchedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ projects, count: projects.length });
}
