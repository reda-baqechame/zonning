import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const requestSchema = z.object({
  module: z.enum(["opportunities", "permits", "tenders", "zoning", "projects"]).default("opportunities"),
  filters: z.record(z.string(), z.unknown()).default({}),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const limited = await rateLimitAsync(`api:v2:alerts:${user.id}:${clientIp(req)}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid alert request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const body = parsed.data;
  if (body.smsEnabled && (!user.phone || !user.phoneVerified)) {
    return NextResponse.json({ error: "A verified phone number is required for SMS alerts" }, { status: 422 });
  }
  const alert = await prisma.alertSubscription.create({
    data: {
      userId: user.id,
      module: body.module,
      filters: JSON.stringify(body.filters),
      emailEnabled: body.emailEnabled,
      smsEnabled: body.smsEnabled,
    },
  });
  return NextResponse.json({ alert, status: "created" }, { status: 201 });
}
