import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/auth";
import { draftCopilot, type CopilotKind } from "@/lib/ai/copilot";

const schema = z.object({
  kind: z.enum(["bid", "outreach", "qualification"]).default("bid"),
  itemId: z.string().trim().min(1).max(200),
  itemType: z.enum(["tender", "permit"]),
  locale: z.enum(["fr", "en"]).default("fr"),
});

/**
 * POST /api/v2/copilot
 *
 * AI bid-draft / SEAO copilot. Drafts a bid, outreach, or qualification note
 * grounded in the user's profile + the tender/permit dossier. Authenticated —
 * uses the caller's RBQ profile as context.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  }

  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:copilot:${user.id}:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await draftCopilot({
      kind: parsed.data.kind as CopilotKind,
      itemId: parsed.data.itemId,
      itemType: parsed.data.itemType,
      locale: parsed.data.locale,
      user: {
        name: user.name,
        companyName: user.companyName,
        rbqLicenseClass: user.rbqLicenseClass,
        trades: user.trades,
      },
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[copilot] failed", err);
    return NextResponse.json({ error: "Échec de la génération." }, { status: 500 });
  }
}
