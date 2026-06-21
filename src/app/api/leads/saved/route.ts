import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const stageSchema = z.enum([
  "new",
  "researching",
  "pursuing",
  "submitted",
  "won",
  "lost",
  "archived",
]);

const bodySchema = z.object({
  kind: z.enum(["permit", "tender"]),
  itemId: z.string().min(1),
  notes: z.string().trim().max(2000).nullable().optional(),
  stage: stageSchema.optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
});

function savedLeadUpdate(body: z.infer<typeof bodySchema>) {
  return {
    ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
    ...(body.stage !== undefined ? { stage: body.stage } : {}),
    ...(body.nextActionAt !== undefined
      ? { nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null }
      : {}),
  };
}

function savedLeadError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  console.error("[api/leads/saved] request failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: "Could not update pipeline" }, { status: 500 });
}

async function leadExists(kind: "permit" | "tender", itemId: string) {
  if (kind === "permit") {
    return (await prisma.permit.count({ where: { id: itemId } })) > 0;
  }
  return (await prisma.tender.count({ where: { id: itemId } })) > 0;
}

async function enforceSavedLeadLimit(req: NextRequest, userId: string) {
  const limited = await rateLimitAsync(
    `api:saved-leads:${userId}:${clientIp(req)}`,
    60,
    60_000,
  );
  return limited.ok ? null : rateLimitResponse(limited.retryAfterSec);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await enforceSavedLeadLimit(req, user.id);
    if (limited) return limited;
    const rows = await prisma.savedLead.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ saved: rows });
  } catch (error) {
    return savedLeadError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await enforceSavedLeadLimit(req, user.id);
    if (limited) return limited;
    const body = bodySchema.parse(await req.json());
    if (!(await leadExists(body.kind, body.itemId))) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    const row = await prisma.savedLead.upsert({
      where: {
        userId_kind_itemId: {
          userId: user.id,
          kind: body.kind,
          itemId: body.itemId,
        },
      },
      create: {
        userId: user.id,
        kind: body.kind,
        itemId: body.itemId,
        notes: body.notes,
        stage: body.stage ?? "new",
        nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
      },
      update: savedLeadUpdate(body),
    });
    return NextResponse.json({ saved: row });
  } catch (error) {
    return savedLeadError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await enforceSavedLeadLimit(req, user.id);
    if (limited) return limited;
    const body = bodySchema.parse(await req.json());
    const result = await prisma.savedLead.updateMany({
      where: { userId: user.id, kind: body.kind, itemId: body.itemId },
      data: savedLeadUpdate(body),
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: "Saved lead not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      notes: body.notes || null,
      stage: body.stage,
      nextActionAt: body.nextActionAt,
    });
  } catch (error) {
    return savedLeadError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await enforceSavedLeadLimit(req, user.id);
    if (limited) return limited;
    const kind = z
      .enum(["permit", "tender"])
      .safeParse(req.nextUrl.searchParams.get("kind"));
    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!kind.success || !itemId) {
      return NextResponse.json(
        { error: "kind and itemId required" },
        { status: 400 },
      );
    }
    await prisma.savedLead.deleteMany({
      where: { userId: user.id, kind: kind.data, itemId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return savedLeadError(error);
  }
}
