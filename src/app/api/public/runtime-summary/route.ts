import { NextRequest, NextResponse } from "next/server";
import { buildPublicRuntimeSummary } from "@/lib/runtime-truth";
import { enforceRateLimit } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

/**
 * Public-safe runtime truth. Read-only DB counts; never triggers sync, never
 * leaks env, dataset ids, or per-error detail. Drives truth-aligned site copy.
 */
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:runtime-summary", 120, 60_000);
  if (limited) return limited;

  const summary = await buildPublicRuntimeSummary();
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
