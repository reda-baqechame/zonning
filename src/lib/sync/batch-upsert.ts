import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Run upserts in a single DB transaction per chunk (fewer round-trips than Promise.all). */
export async function transactionChunkUpsert<T, R>(
  items: T[],
  chunkSize: number,
  upsertOne: (item: T) => Prisma.PrismaPromise<R>
): Promise<{ processed: number; results: R[] }> {
  const configuredTimeout = Number(process.env.PRISMA_TRANSACTION_TIMEOUT_MS ?? 60_000);
  const configuredMaxWait = Number(process.env.PRISMA_TRANSACTION_MAX_WAIT_MS ?? 15_000);
  const timeout =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000;
  const maxWait =
    Number.isFinite(configuredMaxWait) && configuredMaxWait > 0 ? configuredMaxWait : 15_000;
  let processed = 0;
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = await prisma.$transaction(
      chunk.map((item) => upsertOne(item)),
      { maxWait, timeout }
    );
    results.push(...batch);
    processed += chunk.length;
  }
  return { processed, results };
}
