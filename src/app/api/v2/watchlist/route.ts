import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { pinWatchItem, unpinWatchItem, listWatchItems, type WatchKind } from "@/lib/watchlist/engine";

const bodySchema = z.object({
  action: z.enum(["pin", "unpin", "list"]),
  kind: z.enum(["property", "contractor", "company", "tender"]).optional(),
  identifier: z.string().trim().min(1).max(200).optional(),
  label: z.string().trim().min(1).max(200).optional(),
});

/**
 * POST /api/v2/watchlist
 *  { action: "list" }
 *  { action: "pin", kind, identifier, label }
 *  { action: "unpin", kind, identifier }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const limited = await rateLimitAsync(`api:watchlist:${user.id}:${clientIp(req)}`, 40, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;

  try {
    if (b.action === "list") {
      const items = await listWatchItems(user.id);
      return NextResponse.json({ items });
    }
    if (!b.kind || !b.identifier) {
      return NextResponse.json({ error: "kind et identifier requis" }, { status: 400 });
    }
    if (b.action === "pin") {
      await pinWatchItem(user.id, b.kind as WatchKind, b.identifier, b.label ?? b.identifier);
      return NextResponse.json({ status: "pinned" });
    }
    await unpinWatchItem(user.id, b.kind as WatchKind, b.identifier);
    return NextResponse.json({ status: "unpinned" });
  } catch (err) {
    console.error("[watchlist] failed", err);
    return NextResponse.json({ error: "Échec de l'opération watchlist." }, { status: 500 });
  }
}
