import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { FREE_TEST_PRINCIPAL_ID, isFreeTestMode } from "@/lib/free-test";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { parseBoundedInt } from "@/lib/query-params";

export async function GET(req: NextRequest) {
  ensureFreshForKey("tenders");
  const auth = await validateApiKey(req.headers.get("authorization"), "tenders");
  if (!auth && !isFreeTestMode()) {
    return NextResponse.json({ error: "Invalid API key or missing tenders scope" }, { status: 401 });
  }

  const principalId = auth?.orgId ?? FREE_TEST_PRINCIPAL_ID;
  const limited = await rateLimitAsync(`api:v1:tenders:${principalId}`, 100, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const limit = parseBoundedInt(req.nextUrl.searchParams.get("limit"), 50, 1, 200);
  const tenders = await prisma.tender.findMany({
    where: {
      closesAt: { gte: new Date() },
      OR: [{ status: null }, { status: { not: "closed" } }],
    },
    orderBy: { closesAt: "asc" },
    take: limit,
  });

  return NextResponse.json({ tenders, count: tenders.length });
}
