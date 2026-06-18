import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-auth";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { getIntelligenceByAddress } from "@/lib/intelligence";
import { computeVerdictTier } from "@/lib/verdict/compute-verdict";
import { rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req.headers.get("authorization"), "verdict");
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key or missing verdict scope" }, { status: 401 });
  }

  const limited = await rateLimitAsync(`api:v1:verdict:${auth.orgId}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const address = req.nextUrl.searchParams.get("address")?.trim();
  if (!address || address.length < 5) {
    return NextResponse.json({ error: "address query required (min 5 chars)" }, { status: 400 });
  }

  const borough = req.nextUrl.searchParams.get("borough")?.trim() || undefined;
  ensureFreshForKey("verdict");

  const intel = await getIntelligenceByAddress(address, borough);
  const verdict = computeVerdictTier(intel);

  const cached = await prisma.verdictReport.findFirst({
    where: { address, borough: borough ?? null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    address,
    borough: borough ?? null,
    tier: verdict.tier,
    labelFr: verdict.labelFr,
    labelEn: verdict.labelEn,
    reasonsFr: verdict.reasonsFr,
    reasonsEn: verdict.reasonsEn,
    densityGap: verdict.densityGap,
    summaryFr: cached?.summaryFr ?? null,
    summaryEn: cached?.summaryEn ?? null,
    shareSlug: cached?.shareSlug ?? null,
  });
}
