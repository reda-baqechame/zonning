/** Resolve env vars from Vercel marketplace integration names. */

export function resolveDatabaseUrl(): string | undefined {
  // An explicit DATABASE_URL is the canonical override (Prisma convention).
  // This lets local dev pin SQLite (file:./dev.db) even when Vercel marketplace
  // Postgres vars are also present in .env.local. Production leaves DATABASE_URL
  // unset and falls through to POSTGRES_PRISMA_URL below.
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;

  const candidates = [
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  const postgres = candidates.find(
    (u) => u.startsWith("postgres://") || u.startsWith("postgresql://")
  );
  if (postgres) return postgres;
  return candidates[0];
}

/** Direct Postgres URL for migrations/db push (session mode, not transaction pooler). */
export function resolveDirectDatabaseUrl(): string | undefined {
  const nonPooling = process.env.POSTGRES_URL_NON_POOLING?.trim();
  if (nonPooling) return nonPooling;

  const host = process.env.POSTGRES_HOST?.trim();
  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD?.trim();
  const database = process.env.POSTGRES_DATABASE?.trim() ?? "postgres";

  if (host?.startsWith("db.") && user && password) {
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}:5432/${database}?sslmode=require`;
  }

  return (
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL
  )?.trim();
}

export function resolveUpstashRestUrl(): string | undefined {
  return (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim();
}

export function resolveUpstashRestToken(): string | undefined {
  return (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim();
}

export function isPostgresUrl(url?: string): boolean {
  const u = url ?? resolveDatabaseUrl() ?? "";
  return u.startsWith("postgres://") || u.startsWith("postgresql://");
}

export function resolvePgPoolMax(): number {
  const configured = Number(process.env.PG_POOL_MAX);
  if (Number.isInteger(configured) && configured >= 1 && configured <= 20) {
    return configured;
  }

  // Serverless instances multiply pool capacity quickly. Two connections keep
  // Prisma's parallel reads moving without recreating a large pool per instance.
  return process.env.VERCEL ? 2 : 10;
}
