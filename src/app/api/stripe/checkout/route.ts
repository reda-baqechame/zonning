import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { stripe, PLANS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { isStripeDemoMode, getIntegrationStatus } from "@/lib/env";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`stripe:checkout:${ip}`, 15, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    const body = (await req.json()) as { plan: keyof typeof PLANS; locale?: string };
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

    if (!stripe || !planConfig.priceId) {
      if (!isStripeDemoMode()) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan:
            plan === "essentiel"
              ? "ESSENTIEL"
              : plan === "pro"
                ? "PRO"
                : plan === "equipe"
                  ? "EQUIPE"
                  : user.plan,
        },
      });
      return NextResponse.json({
        ok: true,
        demo: true,
        message: "Stripe not configured — plan activated in demo mode",
      });
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
    const message = e instanceof Error ? e.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
