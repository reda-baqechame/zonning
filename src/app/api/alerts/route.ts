import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { canCreateAlert } from "@/lib/plans";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  module: z.enum(["chantier_radar", "marches_qc"]),
  filters: z.record(z.string(), z.unknown()),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:alerts:get:${ip}`, 60, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    const alerts = await prisma.alertSubscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:alerts:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());

    const currentCount = await prisma.alertSubscription.count({
      where: { userId: user.id },
    });

    if (!canCreateAlert(user.plan, currentCount)) {
      return NextResponse.json(
        {
          error:
            "Limite d'alertes atteinte pour votre forfait. Passez à Essentiel ou Pro.",
        },
        { status: 403 }
      );
    }

    const alert = await prisma.alertSubscription.create({
      data: {
        userId: user.id,
        module: body.module,
        filters: JSON.stringify(body.filters),
        emailEnabled: body.emailEnabled ?? true,
        smsEnabled: body.smsEnabled ?? false,
      },
    });

    return NextResponse.json({ alert });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
