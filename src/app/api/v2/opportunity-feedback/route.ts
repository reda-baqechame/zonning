import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const feedbackSchema = z.object({
  recordKind: z.enum(["permit", "tender", "roadwork"]),
  recordId: z.string().min(1),
  action: z.enum(["chase", "watch", "ignore", "bad_match", "already_knew", "acted", "not_relevant", "needs_more_info"]),
  notes: z.string().trim().max(1200).optional(),
});

function stageFromAction(action: z.infer<typeof feedbackSchema>["action"]) {
  if (action === "chase" || action === "acted") return "pursuing";
  if (action === "watch" || action === "needs_more_info") return "researching";
  if (action === "ignore" || action === "bad_match" || action === "not_relevant") return "archived";
  return "new";
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimitAsync(
      `api:v2:opportunity-feedback:${user.id}:${clientIp(req)}`,
      80,
      60_000,
    );
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
    const body = feedbackSchema.parse(await req.json());
    if (body.recordKind === "roadwork") {
      return NextResponse.json({ ok: true, persisted: false });
    }
    const saved = await prisma.savedLead.upsert({
      where: {
        userId_kind_itemId: {
          userId: user.id,
          kind: body.recordKind,
          itemId: body.recordId,
        },
      },
      create: {
        userId: user.id,
        kind: body.recordKind,
        itemId: body.recordId,
        stage: stageFromAction(body.action),
        notes: body.notes ? `${body.action}: ${body.notes}` : body.action,
      },
      update: {
        stage: stageFromAction(body.action),
        notes: body.notes ? `${body.action}: ${body.notes}` : body.action,
      },
    });
    return NextResponse.json({ ok: true, persisted: true, saved });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Invalid feedback" }, { status });
  }
}
