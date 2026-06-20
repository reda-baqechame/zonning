import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

const requestSchema = z.object({
  locale: z.enum(["fr", "en"]).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`stripe:portal:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  try {
    const user = await requireUser();
    if (!user.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account — subscribe via pricing first" },
        { status: 400 }
      );
    }

    const body = requestSchema.parse(await req.json().catch(() => ({})));
    const locale = body.locale === "en" ? "en" : "fr";
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/${locale}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid portal request" }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Portal failed";
    const status = message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
