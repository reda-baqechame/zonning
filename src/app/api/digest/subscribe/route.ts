import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { digestWelcomeEmail } from "@/lib/email/templates";

const schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  borough: z.string().trim().max(120).optional(),
  trade: z.string().trim().max(120).optional(),
  locale: z.enum(["fr", "en"]).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:digest:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = schema.parse(await req.json());
    const locale = body.locale === "en" ? "en" : "fr";

    await prisma.digestSubscriber.upsert({
      where: { email: body.email },
      create: {
        email: body.email,
        borough: body.borough,
        trade: body.trade,
        locale,
      },
      update: {
        borough: body.borough,
        trade: body.trade,
        active: true,
        locale,
      },
    });

    let emailQueued = false;
    if (process.env.RESEND_API_KEY) {
      const { subject, html } = digestWelcomeEmail({
        locale,
        email: body.email,
        borough: body.borough,
        trade: body.trade,
      });
      const result = await sendEmail({
        to: body.email,
        subject,
        html,
        type: "digest_welcome",
      });
      emailQueued = result.ok;
    }

    return NextResponse.json({ ok: true, emailQueued });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
