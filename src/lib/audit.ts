import { prisma } from "@/lib/prisma";

export type AuditEntry = {
  action: string;
  resource?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  requestId?: string | null;
};

/** Fire-and-forget audit log — never blocks the request path on failure. */
export function auditLog(entry: AuditEntry): void {
  void prisma.auditLog
    .create({
      data: {
        action: entry.action,
        resource: entry.resource ?? null,
        actorId: entry.actorId ?? null,
        actorEmail: entry.actorEmail ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: entry.ip ?? null,
        requestId: entry.requestId ?? null,
      },
    })
    .catch((err) => {
      console.warn("[audit] failed to write log", entry.action, err);
    });
}
