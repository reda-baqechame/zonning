import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { getRequestId } from "@/lib/request-id";

export const runtime = "nodejs";

function planFromMetadata(plan?: string | null): Plan | null {
  switch (plan) {
    case "essentiel":
      return "ESSENTIEL";
    case "pro":
      return "PRO";
    case "equipe":
      return "EQUIPE";
    default:
      return null;
  }
}

async function updateUserPlan(
  userId: string,
  plan: Plan,
  customerId?: string | null,
  subscriptionId?: string | null
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      ...(subscriptionId !== undefined ? { stripeSubscriptionId: subscriptionId } : {}),
    },
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planKey = session.metadata?.plan;
  if (!userId) return;

  if (planKey === "concierge") {
    await prisma.conciergeRequest.upsert({
      where: { userId },
      create: {
        userId,
        status: "pending",
        stripeSessionId: session.id,
      },
      update: {
        status: "pending",
        stripeSessionId: session.id,
      },
    });
    return;
  }

  const plan = planFromMetadata(planKey);
  if (!plan) return;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  await updateUserPlan(userId, plan, customerId, subscriptionId ?? null);

  if (plan === "EQUIPE") {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const org = await prisma.organization.upsert({
        where: { ownerId: userId },
        create: {
          name: user.companyName ?? `${user.name ?? user.email} — Équipe`,
          plan: "EQUIPE",
          ownerId: userId,
          stripeSubscriptionId: subscriptionId ?? null,
        },
        update: {
          plan: "EQUIPE",
          stripeSubscriptionId: subscriptionId ?? null,
        },
      });
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId } },
        create: { orgId: org.id, userId, role: "owner" },
        update: {},
      });
    }
  }
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (!user) return;

  if (sub.status === "active" || sub.status === "trialing") {
    const plan = planFromMetadata(sub.metadata?.plan);
    if (plan) {
      await updateUserPlan(user.id, plan, customerId, sub.id);
    }
  } else if (sub.status === "canceled" || sub.status === "unpaid") {
    await updateUserPlan(user.id, "FREE", customerId, null);
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) return;
  await updateUserPlan(user.id, "FREE", customerId, null);
}

async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;
  await updateUserPlan(userId, "FREE");
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const requestId = getRequestId(req);
  const existing = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    case "checkout.session.async_payment_failed":
      await handleAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
      break;
  }

  await prisma.processedStripeEvent.create({
    data: { id: event.id, type: event.type },
  });

  auditLog({
    action: "stripe.webhook",
    resource: event.type,
    metadata: { eventId: event.id },
    requestId,
  });

  return NextResponse.json({ received: true });
}
