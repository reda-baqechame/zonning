import { NextRequest, NextResponse } from "next/server";
import { parseV2SiteQuery } from "@/lib/api/v2-site-query";
import { enforceV2RateLimit, isV2Access, requireV2Access } from "@/lib/api/v2-access";
import { findSitePermitEvents } from "@/lib/api/v2";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireV2Access(req, "permits");
  if (!isV2Access(access)) return access;
  const limited = await enforceV2RateLimit(req, "site-permits", access, 60);
  if (limited) return limited;

  const { id } = await params;
  const parsed = parseV2SiteQuery(req, id);
  if (!parsed.success) return NextResponse.json({ error: "Invalid site query" }, { status: 400 });
  const { address, city } = parsed.data;
  const permits = await findSitePermitEvents(address, city);

  return NextResponse.json({
    siteId: id,
    status: permits.length ? "ok" : "insufficient_data",
    permits,
    limitations: permits.length ? [] : ["No comparable municipal permit events were found for this address query."],
  });
}
