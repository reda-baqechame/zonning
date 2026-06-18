import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createApiKey } from "@/lib/api-auth";
import { randomBytes } from "crypto";
import { z } from "zod";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { getRequestId } from "@/lib/request-id";

const inviteSchema = z.object({
  action: z.literal("invite"),
  email: z.string().email(),
  role: z.enum(["admin", "member"]).optional(),
});

const createApiKeySchema = z.object({
  action: z.literal("create_api_key"),
  name: z.string().min(1).max(80).optional(),
});

const revokeApiKeySchema = z.object({
  action: z.literal("revoke_api_key"),
  keyId: z.string().min(1),
});

const createWebhookSchema = z.object({
  action: z.literal("create_webhook"),
  url: z.string().url().startsWith("https://"),
  events: z.string().max(200).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const deleteWebhookSchema = z.object({
  action: z.literal("delete_webhook"),
  webhookId: z.string().min(1),
});

const orgActionSchema = z.discriminatedUnion("action", [
  inviteSchema,
  createApiKeySchema,
  revokeApiKeySchema,
  createWebhookSchema,
  deleteWebhookSchema,
]);

async function rateLimitOrg(userId: string, req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:org:${userId}:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await rateLimitOrg(user.id, req);
    if (limited) return limited;

    const org =
      (await prisma.organization.findUnique({ where: { ownerId: user.id } })) ??
      (await prisma.orgMember.findFirst({
        where: { userId: user.id },
        include: { org: { include: { members: true, apiKeys: true } } },
      }))?.org;

    if (!org) {
      return NextResponse.json({ org: null, members: [], apiKeys: [] });
    }

    const full = await prisma.organization.findUnique({
      where: { id: org.id },
      include: {
        members: { include: { user: { select: { id: true, email: true, name: true } } } },
        apiKeys: { select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true } },
        webhooks: { select: { id: true, url: true, events: true, filters: true, active: true, createdAt: true } },
      },
    });

    return NextResponse.json(full);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.plan !== "EQUIPE") {
      return NextResponse.json({ error: "Équipe plan required" }, { status: 403 });
    }

    const limited = await rateLimitOrg(user.id, req);
    if (limited) return limited;

    const body = orgActionSchema.parse(await req.json());
    const requestId = getRequestId(req);
    const ip = clientIp(req);

    let org = await prisma.organization.findUnique({ where: { ownerId: user.id } });
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: user.companyName ?? `${user.name} — Équipe`,
          ownerId: user.id,
          plan: "EQUIPE",
        },
      });
      await prisma.orgMember.create({
        data: { orgId: org.id, userId: user.id, role: "owner" },
      });
    }

    if (body.action === "create_api_key") {
      const { key, keyPrefix } = await createApiKey(org.id, body.name ?? "Default");
      auditLog({
        action: "org.api_key.create",
        resource: org.id,
        actorId: user.id,
        actorEmail: user.email,
        ip,
        requestId,
      });
      return NextResponse.json({ key, keyPrefix, message: "Save this key — shown once" });
    }

    if (body.action === "invite") {
      const memberCount = await prisma.orgMember.count({ where: { orgId: org.id } });
      if (memberCount >= 5) {
        return NextResponse.json({ error: "5 seat limit reached" }, { status: 400 });
      }

      const invitee = await prisma.user.findUnique({ where: { email: body.email } });
      if (!invitee) {
        return NextResponse.json({ error: "User must register first" }, { status: 404 });
      }

      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: invitee.id } },
        create: { orgId: org.id, userId: invitee.id, role: body.role ?? "member" },
        update: {},
      });

      auditLog({
        action: "org.member.invite",
        resource: org.id,
        actorId: user.id,
        actorEmail: user.email,
        metadata: { email: body.email },
        ip,
        requestId,
      });

      return NextResponse.json({ ok: true });
    }

    if (body.action === "revoke_api_key") {
      await prisma.apiKey.deleteMany({ where: { id: body.keyId, orgId: org.id } });
      auditLog({
        action: "org.api_key.revoke",
        resource: body.keyId,
        actorId: user.id,
        actorEmail: user.email,
        ip,
        requestId,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "create_webhook") {
      const secret = randomBytes(32).toString("hex");
      const filters = body.filters ? JSON.stringify(body.filters) : null;
      const webhook = await prisma.orgWebhook.create({
        data: {
          orgId: org.id,
          url: body.url,
          secret,
          events: body.events ?? "permit.created,tender.created",
          filters,
        },
      });
      auditLog({
        action: "org.webhook.create",
        resource: webhook.id,
        actorId: user.id,
        actorEmail: user.email,
        ip,
        requestId,
      });
      return NextResponse.json({
        webhook: { id: webhook.id, url: webhook.url, events: webhook.events },
        secret,
        message: "Save webhook secret — shown once",
      });
    }

    if (body.action === "delete_webhook") {
      await prisma.orgWebhook.deleteMany({ where: { id: body.webhookId, orgId: org.id } });
      auditLog({
        action: "org.webhook.delete",
        resource: body.webhookId,
        actorId: user.id,
        actorEmail: user.email,
        ip,
        requestId,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
