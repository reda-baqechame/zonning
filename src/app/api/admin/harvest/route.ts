import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { getRequestId } from "@/lib/request-id";
import { harvestCkanCatalog, getKnownCkanIds } from "@/lib/datasets/harvester";

/**
 * GET /api/admin/harvest?rows=800&category=permits
 *
 * Crawls the Données Québec CKAN catalog and returns ranked construction-relevant
 * datasets not yet wired into the registry. Admin-only — this is the data-acquisition
 * command center for taking ZONNING from 57 registered datasets to all of Quebec.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:admin-harvest:${user.id}:${ip}`, 4, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const sp = req.nextUrl.searchParams;
  const rows = Number(sp.get("rows")) || 800;
  const category = sp.get("category");
  const query = sp.get("query") ?? undefined;

  try {
    const known = await getKnownCkanIds();
    const result = await harvestCkanCatalog({
      maxRows: rows,
      query,
      knownCkanIds: known,
      minRelevance: 50,
    });

    const candidates = category
      ? result.candidates.filter((c) => c.category === category)
      : result.candidates;

    auditLog({
      action: "admin.harvest",
      resource: "ckan:donneesquebec",
      actorId: user.id,
      actorEmail: user.email,
      ip,
      requestId: getRequestId(req),
      metadata: { scanned: result.totalScanned, candidates: candidates.length, new: result.newCandidates },
    });

    return NextResponse.json(
      {
        ...result,
        candidates,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[harvest] admin route failed", err);
    return NextResponse.json({ error: "Harvest failed" }, { status: 500 });
  }
}
