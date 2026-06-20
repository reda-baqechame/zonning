import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getStripe, PLANS } from "@/lib/stripe";
import { getIntegrationStatus } from "@/lib/env";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

const requestSchema = z.object({
  plan: z.enum(["essentiel", "pro", "equipe", "concierge"]),
  locale: z.enum(["fr", "en"]).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`stripe:checkout:${ip}`, 15, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    const body = requestSchema.parse(await req.json());
    const { plan } = body;
    const locale = body.locale === "en" ? "en" : "fr";

    const planConfig = PLANS[plan];
    if (!planConfig) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const integrations = getIntegrationStatus();
    if (integrations.stripeMisconfigured) {
      return NextResponse.json(
        { error: "Stripe partially configured — contact support" },
        { status: 503 }
      );
    }

    const stripe = getStripe();
    if (!stripe || !planConfig.priceId) {
      return NextResponse.json(
        { error: "Billing is not available. No plan change was made." },
        { status: 503 }
      );
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "oneTime" in planConfig && planConfig.oneTime ? "payment" : "subscription",
      customer_email: user.email,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${base}/${locale}/feed?checkout=success`,
      cancel_url: `${base}/${locale}/pricing?checkout=cancel`,
      metadata: { userId: user.id, plan },
      subscription_data:
        "oneTime" in planConfig && planConfig.oneTime
          ? undefined
          : { metadata: { userId: user.id, plan } },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Checkout failed";
    const status = message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
