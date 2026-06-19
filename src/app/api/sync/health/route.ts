import { NextRequest, NextResponse } from "next/server";
import { getLiveMaxAgeMinutes } from "@/lib/sync/live-watch";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { enforceRateLimit } from "@/lib/api-guard";
import { buildSyncHealthSummary, syncAutomationMeta } from "@/lib/sync/health-summary";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:sync-health", 30, 60_000);
  if (limited) return limited;

  const authorized = isSyncAuthorized(req);
  const { ok, summary, datasets, checkedAt } = await buildSyncHealthSummary({ authorized });

  return NextResponse.json({
    ok,
    automation: syncAutomationMeta(authorized),
    summary: {
      ...summary,
      freshnessSla: {
        fastMinutes: getLiveMaxAgeMinutes(),
        dailyHours: 4,
        weeklyDays: 7,
      },
    },
    datasets,
    checkedAt,
  });
}
