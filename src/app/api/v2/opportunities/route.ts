import { NextRequest, NextResponse } from "next/server";
import { buildOpportunities } from "@/lib/api/v2";
import { parseBoundedInt } from "@/lib/query-params";
import {
  enforceV2RateLimit,
  isV2Access,
  requireV2Access,
} from "@/lib/api/v2-access";

export async function GET(req: NextRequest) {
  const access = await requireV2Access(req, "tenders");
  if (!isV2Access(access)) return access;
  const limited = await enforceV2RateLimit(req, "opportunities", access, 60);
  if (limited) return limited;

  const limit = parseBoundedInt(req.nextUrl.searchParams.get("limit"), 25, 1, 100);
  return NextResponse.json({ version: "v2", opportunities: await buildOpportunities(limit) });
}
