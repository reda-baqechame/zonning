import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";

import { isAdminEmail } from "@/lib/admin";

const deliverSchema = z.object({
  userId: z.string(),
  opportunities: z.array(
    z.object({
      type: z.string(),
      title: z.string(),
      url: z.string().optional(),
    })
  ),
  notes: z.string().optional(),
  status: z.enum(["pending", "delivered", "completed"]).optional(),
});

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:admin-concierge:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await prisma.conciergeRequest.findMany({
      include: {
        user: { select: { id: true, email: true, name: true, companyName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:admin-concierge:${ip}`, 15, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = deliverSchema.parse(await req.json());

    const updated = await prisma.conciergeRequest.update({
      where: { userId: body.userId },
      data: {
        opportunities: JSON.stringify(body.opportunities),
        notes: body.notes,
        status: body.status ?? "delivered",
        completedAt: body.status === "completed" ? new Date() : undefined,
      },
      include: {
        user: { select: { email: true, name: true } },
      },
    });

    if ((body.status ?? "delivered") === "delivered" && process.env.RESEND_API_KEY) {
      try {
        const { sendEmail } = await import("@/lib/email/resend");
        const oppList = body.opportunities
          .map((o) => `<li>${o.title}${o.url ? ` — <a href="${o.url}">${o.url}</a>` : ""}</li>`)
          .join("");
        await sendEmail({
          to: updated.user.email,
          subject: "[ZONNING] Nouvelles opportunités Concierge",
          html: `<p>Bonjour${updated.user.name ? ` ${updated.user.name}` : ""},</p>
            <p>Votre analyste ZONNING a livré de nouvelles opportunités :</p>
            <ul>${oppList}</ul>
            ${body.notes ? `<p><strong>Notes :</strong> ${body.notes}</p>` : ""}
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/concierge">Voir dans ZONNING</a></p>`,
        });
      } catch {
        /* email optional */
      }
    }

    return NextResponse.json({ request: updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
