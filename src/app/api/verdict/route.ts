import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { getIntelligenceByAddress } from "@/lib/intelligence";
import { computeVerdictTier } from "@/lib/verdict/compute-verdict";
import { summarizeVerdict } from "@/lib/ai/verdict-summary";
import { createHash } from "crypto";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { enforceRateLimit } from "@/lib/api-guard";
import { z } from "zod";

const FREE_VERDICTS_PER_DAY = 10;

function slugFor(address: string, borough?: string) {
  const hash = createHash("sha256")
    .update(`${address}|${borough ?? ""}`)
    .digest("hex")
    .slice(0, 12);
  return hash;
}

const verdictPostSchema = z.object({
  address: z.string().trim().min(5).max(300),
  borough: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
});

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:verdict:get", 120, 60_000);
  if (limited) return limited;

  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const report = await prisma.verdictReport.findUnique({ where: { shareSlug: slug } });
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const utmSource = req.nextUrl.searchParams.get("utm_source");
  const referer = req.headers.get("referer");
  const referrer = utmSource ?? referer ?? undefined;

  await prisma.verdictReport.update({
    where: { id: report.id },
    data: {
      viewCount: { increment: 1 },
      ...(referrer ? { referrer: referrer.slice(0, 500) } : {}),
    },
  });

  const intel = report.inputsJson ? JSON.parse(report.inputsJson) : {};
  const verdict = computeVerdictTier(intel);

  return NextResponse.json({
    report: {
      ...report,
      verdict,
    },
  });
}

export async function POST(req: NextRequest) {
  ensureFreshForKey("verdict");
  try {
    const body = verdictPostSchema.parse(await req.json());
    const address = body.address;

    const user = await getSessionUser();

    if (!user || user.plan === "FREE") {
      const limited = await rateLimitAsync(
        `verdict:ip:${clientIp(req)}`,
        FREE_VERDICTS_PER_DAY,
        24 * 60 * 60 * 1000
      );
      if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
    }

    const borough = body.borough || undefined;
    const city = body.city || undefined;
    const shareSlug = slugFor(address, borough);

    const existing = await prisma.verdictReport.findUnique({ where: { shareSlug } });
    if (existing) {
      return NextResponse.json({ report: existing, cached: true });
    }

    const intel = await getIntelligenceByAddress(address, borough, city);
    const verdict = computeVerdictTier(intel);
    const { summaryFr, summaryEn } = await summarizeVerdict(address, borough, verdict, intel);

    const report = await prisma.verdictReport.create({
      data: {
        shareSlug,
        address,
        borough: borough ?? null,
        tier: verdict.tier,
        summaryFr,
        summaryEn,
        inputsJson: JSON.stringify(intel),
      },
    });

    return NextResponse.json({
      report: { ...report, verdict },
      cached: false,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verdict failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
