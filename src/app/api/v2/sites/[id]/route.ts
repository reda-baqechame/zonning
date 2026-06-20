import { NextRequest, NextResponse } from "next/server";
import { buildSiteDossier } from "@/lib/api/v2";
import { parseV2SiteQuery } from "@/lib/api/v2-site-query";
import { enforceV2RateLimit, isV2Access, requireV2Access } from "@/lib/api/v2-access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireV2Access(req, "verdict");
  if (!isV2Access(access)) return access;
  const limited = await enforceV2RateLimit(req, "sites", access, 60);
  if (limited) return limited;

  const { id } = await params;
  const parsed = parseV2SiteQuery(req, id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid site query" }, { status: 400 });
  }
  return NextResponse.json(await buildSiteDossier(parsed.data));
}
