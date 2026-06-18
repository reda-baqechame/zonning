import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { enforceRateLimit } from "@/lib/api-guard";
import { clampQuery } from "@/lib/query-params";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:permit-delays", 60, 60_000);
  if (limited) return limited;

  ensureFreshForKey("intelligence");
  const borough = clampQuery(req.nextUrl.searchParams.get("borough"), 80);

  const delays = await prisma.boroughPermitDelay.findMany({
    where: borough ? { borough: { contains: borough } } : {},
    orderBy: [{ borough: "asc" }, { phase: "asc" }],
    take: 100,
  });

  return NextResponse.json({ delays, count: delays.length });
}
