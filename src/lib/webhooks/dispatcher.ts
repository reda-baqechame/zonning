import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 3;

async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body = JSON.stringify({ event, data: payload, ts: Date.now() });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload: body,
      status: "pending",
    },
  });

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Zonning-Signature": signature,
          "X-Zonning-Event": event,
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });

      if (res.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "delivered", attempts: attempt, deliveredAt: new Date() },
        });
        return;
      }
      lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Delivery failed";
    }

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { attempts: attempt, lastError },
    });

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: "failed", lastError },
  });
}

export async function dispatchWebhookEvent(
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await prisma.orgWebhook.findMany({
    where: { active: true },
  });

  const matching = webhooks.filter((w) => {
    if (!w.events.split(",").map((e) => e.trim()).includes(event)) return false;
    if (!w.filters) return true;
    try {
      const filters = JSON.parse(w.filters) as {
        boroughs?: string[];
        cities?: string[];
        minCost?: number;
      };
      if (filters.boroughs?.length && payload.borough) {
        const b = String(payload.borough);
        if (!filters.boroughs.some((x) => b.includes(x))) return false;
      }
      if (filters.cities?.length && payload.city) {
        const c = String(payload.city);
        if (!filters.cities.includes(c)) return false;
      }
      if (filters.minCost != null && payload.estimatedCost != null) {
        if (Number(payload.estimatedCost) < filters.minCost) return false;
      }
    } catch {
      return true;
    }
    return true;
  });

  await Promise.all(
    matching.map((w) => deliverWebhook(w.id, w.url, w.secret, event, payload))
  );
}

export async function dispatchHighScoreLeadEvents(permitIds: string[]): Promise<void> {
  if (permitIds.length === 0) return;

  const permits = await prisma.permit.findMany({
    where: { id: { in: permitIds } },
    take: 50,
  });

  for (const permit of permits) {
    if ((permit.estimatedCost ?? 0) < 500_000) continue;
    void dispatchWebhookEvent("lead.high_score", {
      id: permit.id,
      externalId: permit.externalId,
      address: permit.address,
      city: permit.city,
      borough: permit.borough,
      permitType: permit.permitType,
      estimatedCost: permit.estimatedCost,
      issueDate: permit.issueDate?.toISOString(),
      scoreHint: "high_value",
    });
  }
}

export async function dispatchPermitCreatedEvents(permitIds: string[]): Promise<void> {
  if (permitIds.length === 0) return;

  const permits = await prisma.permit.findMany({
    where: { id: { in: permitIds } },
    take: 50,
  });

  for (const permit of permits) {
    void dispatchWebhookEvent("permit.created", {
      id: permit.id,
      externalId: permit.externalId,
      address: permit.address,
      city: permit.city,
      borough: permit.borough,
      permitType: permit.permitType,
      estimatedCost: permit.estimatedCost,
      issueDate: permit.issueDate?.toISOString(),
    });
  }
}

export async function dispatchTenderCreatedEvents(tenderIds: string[]): Promise<void> {
  if (tenderIds.length === 0) return;

  const tenders = await prisma.tender.findMany({
    where: { id: { in: tenderIds } },
    take: 50,
  });

  for (const tender of tenders) {
    void dispatchWebhookEvent("tender.created", {
      id: tender.id,
      externalId: tender.externalId,
      title: tender.title,
      closesAt: tender.closesAt?.toISOString(),
      organization: tender.organization,
    });
  }
}
