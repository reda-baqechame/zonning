import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  borough: z.string().optional(),
  trade: z.string().optional(),
  locale: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:digest:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = schema.parse(await req.json());
    await prisma.digestSubscriber.upsert({
      where: { email: body.email },
      create: {
        email: body.email,
        borough: body.borough,
        trade: body.trade,
        locale: body.locale ?? "fr",
      },
      update: {
        borough: body.borough,
        trade: body.trade,
        active: true,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
