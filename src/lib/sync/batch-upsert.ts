import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/** Run upserts in a single DB transaction per chunk (fewer round-trips than Promise.all). */
export async function transactionChunkUpsert<T, R>(
  items: T[],
  chunkSize: number,
  upsertOne: (item: T) => Prisma.PrismaPromise<R>
): Promise<{ processed: number; results: R[] }> {
  let processed = 0;
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = await prisma.$transaction(chunk.map((item) => upsertOne(item)));
    results.push(...batch);
    processed += chunk.length;
  }
  return { processed, results };
}
