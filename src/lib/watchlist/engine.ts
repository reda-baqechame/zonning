/**
 * Watch-list — pin properties / contractors / tenders and get notified on
 * graph changes (new permit, new sale, new infraction, tender won).
 *
 * Two parts:
 *  1. WatchItem CRUD (pin/unpin/list) — user-driven.
 *  2. changeDetector — runs after ingest (and on a cron) to diff the current
 *     state of each watched entity against its last-seen snapshot and emit
 *     WatchNotification rows + optional emails.
 *
 * Snapshot keys per kind are intentionally small and stable (counts + latest
 * record ids), so a diff is cheap and meaningful.
 */

import { prisma } from "@/lib/prisma";

export type WatchKind = "property" | "contractor" | "company" | "tender";

export interface WatchSnapshot {
  permitCount: number;
  latestPermitId: string | null;
  transactionCount: number;
  latestTransactionId: string | null;
  infractionCount: number;
  awardCount: number;
}

const SNAPSHOT_KEY = "watch:lastSnapshot";

/** Capture the current observable state of a watched entity. */
async function snapshot(kind: WatchKind, identifier: string): Promise<WatchSnapshot> {
  let permitCount = 0;
  let latestPermitId: string | null = null;
  let transactionCount = 0;
  let latestTransactionId: string | null = null;
  let infractionCount = 0;
  let awardCount = 0;

  if (kind === "property") {
    const matricule = identifier;
    const permits = await prisma.permit.findMany({ where: { matricule }, orderBy: { issueDate: "desc" }, take: 1, select: { id: true } });
    permitCount = await prisma.permit.count({ where: { matricule } });
    latestPermitId = permits[0]?.id ?? null;
    transactionCount = await prisma.propertyTransaction.count({ where: { matricule } });
    const tx = await prisma.propertyTransaction.findMany({ where: { matricule }, orderBy: { saleDate: "desc" }, take: 1, select: { id: true } });
    latestTransactionId = tx[0]?.id ?? null;
  } else if (kind === "contractor" || kind === "company") {
    // Resolve to a company to read activity.
    const company =
      kind === "contractor"
        ? await prisma.company.findFirst({ where: { rbqNumber: identifier } })
        : await prisma.company.findUnique({ where: { neq: identifier } });
    if (company) {
      const name = company.name;
      const awards = await prisma.tenderAward.findMany({ where: { winnerName: { contains: name } }, orderBy: { awardDate: "desc" }, take: 1, select: { id: true } });
      awardCount = await prisma.tenderAward.count({ where: { winnerName: { contains: name } } });
      if (company.rbqNumber) {
        infractionCount = await prisma.rbqInfraction.count({ where: { licenseNumber: company.rbqNumber } });
      }
      void awards;
    }
  } else if (kind === "tender") {
    const awards = await prisma.tenderAward.findMany({
      where: { title: { contains: identifier } },
      orderBy: { awardDate: "desc" },
      take: 1,
      select: { id: true, winnerName: true },
    });
    awardCount = awards.length;
  }

  return { permitCount, latestPermitId, transactionCount, latestTransactionId, infractionCount, awardCount };
}

type Diff = {
  signal: string;
  title: string;
  detail: string;
  sourceUrl?: string;
};

/** Compare two snapshots → list of human-readable changes. */
function diffSnapshots(prev: WatchSnapshot, next: WatchSnapshot): Diff[] {
  const out: Diff[] = [];
  if (next.permitCount > prev.permitCount) {
    out.push({
      signal: "new_permit",
      title: "Nouveau permis",
      detail: `${next.permitCount - prev.permitCount} nouveau(x) permis sur ce terrain (total ${next.permitCount}).`,
    });
  }
  if (next.transactionCount > prev.transactionCount) {
    out.push({
      signal: "new_sale",
      title: "Nouvelle vente",
      detail: `Vente immobilière enregistrée (total ${next.transactionCount}).`,
    });
  }
  if (next.infractionCount > prev.infractionCount) {
    out.push({
      signal: "new_infraction",
      title: "Nouvelle infraction RBQ",
      detail: `${next.infractionCount - prev.infractionCount} nouvelle(s) infraction(s) indexée(s).`,
    });
  }
  if (next.awardCount > prev.awardCount) {
    out.push({
      signal: "tender_won",
      title: "Nouvelle adjudication",
      detail: `Nouvelle adjudication de contrat détectée (total ${next.awardCount}).`,
    });
  }
  return out;
}

/**
 * Scan all watched items, diff against stored snapshots, emit notifications.
 * Returns the number of notifications created. Safe to run from a cron or
 * after ingest.
 */
export async function detectWatchChanges(): Promise<number> {
  const items = await prisma.watchItem.findMany({ include: { notifications: { orderBy: { createdAt: "desc" }, take: 1 } } });
  let created = 0;

  for (const item of items) {
    const kind = item.kind as WatchKind;
    const next = await snapshot(kind, item.identifier);
    const stored = item.note ? parseStoredSnapshot(item.note) : null;

    if (stored) {
      const diffs = diffSnapshots(stored, next);
      for (const d of diffs) {
        // Avoid duplicate notifications for the same signal in close succession.
        const recent = item.notifications[0];
        if (recent && recent.signal === d.signal && Date.now() - recent.createdAt.getTime() < 6 * 3600_000) {
          continue;
        }
        await prisma.watchNotification.create({
          data: {
            userId: item.userId,
            watchItemId: item.id,
            signal: d.signal,
            title: d.title,
            detail: d.detail,
            sourceUrl: d.sourceUrl,
          },
        });
        created++;
      }
    }

    // Persist the new snapshot in the note field (JSON-encoded under a key).
    await prisma.watchItem.update({
      where: { id: item.id },
      data: { note: JSON.stringify({ [SNAPSHOT_KEY]: next, userNote: extractUserNote(item.note) }) },
    });
  }

  return created;
}

function parseStoredSnapshot(note: string): WatchSnapshot | null {
  try {
    const parsed = JSON.parse(note);
    return parsed?.[SNAPSHOT_KEY] ?? null;
  } catch {
    return null;
  }
}

function extractUserNote(note: string | null): string | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note);
    return parsed?.userNote ?? null;
  } catch {
    return note; // legacy freeform note
  }
}

// ---- CRUD ------------------------------------------------------------------

export async function pinWatchItem(userId: string, kind: WatchKind, identifier: string, label: string): Promise<void> {
  await prisma.watchItem.upsert({
    where: { userId_kind_identifier: { userId, kind, identifier } },
    update: { label },
    create: { userId, kind, identifier, label },
  });
  // Seed the snapshot so the first diff isn't a false positive.
  const snap = await snapshot(kind, identifier);
  await prisma.watchItem.update({
    where: { userId_kind_identifier: { userId, kind, identifier } },
    data: { note: JSON.stringify({ [SNAPSHOT_KEY]: snap, userNote: null }) },
  });
}

export async function unpinWatchItem(userId: string, kind: WatchKind, identifier: string): Promise<void> {
  await prisma.watchItem.deleteMany({ where: { userId, kind, identifier } });
}

export async function listWatchItems(userId: string) {
  return prisma.watchItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { notifications: { where: { read: false }, take: 5, orderBy: { createdAt: "desc" } } },
  });
}

export async function listNotifications(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
  return prisma.watchNotification.findMany({
    where: { userId, ...(opts.unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 30,
    include: { watchItem: { select: { kind: true, identifier: true, label: true } } },
  });
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await prisma.watchNotification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}
