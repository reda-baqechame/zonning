import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(orgId: string, name: string) {
  const raw = `zn_${randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(raw);
  const keyPrefix = raw.slice(0, 12);

  await prisma.apiKey.create({
    data: { orgId, name, keyHash, keyPrefix, scopes: "permits,tenders,verdict" },
  });

  return { key: raw, keyPrefix };
}

export async function validateApiKey(
  authHeader: string | null,
  requiredScope?: string
): Promise<{ orgId: string; scopes: string[] } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7).trim();
  if (!key.startsWith("zn_")) return null;

  const keyHash = hashApiKey(key);
  const record = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!record) return null;

  const scopes = record.scopes.split(",").map((s) => s.trim()).filter(Boolean);
  if (
    requiredScope &&
    !scopes.includes(requiredScope) &&
    !scopes.includes("*")
  ) {
    return null;
  }

  await prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { orgId: record.orgId, scopes };
}
