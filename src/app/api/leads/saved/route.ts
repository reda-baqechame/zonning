import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const bodySchema = z.object({
  kind: z.enum(["permit", "tender"]),
  itemId: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await prisma.savedLead.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ saved: rows });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = bodySchema.parse(await req.json());
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
      },
      update: { notes: body.notes },
    });
    return NextResponse.json({ saved: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const kind = req.nextUrl.searchParams.get("kind");
    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!kind || !itemId) {
      return NextResponse.json({ error: "kind and itemId required" }, { status: 400 });
    }
    await prisma.savedLead.deleteMany({
      where: { userId: user.id, kind, itemId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
