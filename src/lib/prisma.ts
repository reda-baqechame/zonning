import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { isPostgresUrl, resolveDatabaseUrl, resolvePgPoolMax } from "./env-resolve";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const url = resolveDatabaseUrl();

  if (process.env.NODE_ENV === "production" && !url) {
    throw new Error(
      "Database URL is not configured. Connect Supabase on Vercel or set DATABASE_URL / POSTGRES_PRISMA_URL."
    );
  }

  const resolved = url ?? "file:./dev.db";

  if (isPostgresUrl(resolved)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    const useSupabaseSsl =
      resolved.includes("supabase.com") || resolved.includes("supabase.co");
    const connectionString = useSupabaseSsl
      ? resolved.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "")
      : resolved;
    const pool = new Pool({
      connectionString,
      max: resolvePgPoolMax(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: useSupabaseSsl ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (error) => {
      console.warn("[database] Dropped idle PostgreSQL connection; the pool will reconnect.", error.message);
    });
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }

  const adapter = new PrismaBetterSqlite3({ url: resolved });
  return new PrismaClient({ adapter });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Lazy client — allows /api/health to load before DATABASE_URL is configured. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function isPostgres(): boolean {
  return isPostgresUrl();
}
