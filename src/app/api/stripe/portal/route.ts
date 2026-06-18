import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`stripe:portal:${ip}`, 10, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

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

    const body = (await req.json().catch(() => ({}))) as { locale?: string };
    const locale = body.locale === "en" ? "en" : "fr";
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${base}/${locale}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Portal failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
