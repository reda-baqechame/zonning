import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { resolveDatabaseUrl, resolveUpstashRestToken, resolveUpstashRestUrl } from "../src/lib/env-resolve";

const SCHEMA = join(process.cwd(), "prisma", "schema.prisma");

export function isPostgresUrl(url?: string): boolean {
  const u = url ?? resolveDatabaseUrl() ?? "";
  return u.startsWith("postgres://") || u.startsWith("postgresql://");
}

/** Set schema provider to match DATABASE_URL before prisma db push / migrate. */
export function ensureDbProvider(url?: string): "sqlite" | "postgresql" {
  const provider = isPostgresUrl(url ?? resolveDatabaseUrl()) ? "postgresql" : "sqlite";
  const content = readFileSync(SCHEMA, "utf8");
  const next = content.replace(
    /provider\s*=\s*"(sqlite|postgresql)"/,
    `provider = "${provider}"`
  );
  if (next !== content) {
    writeFileSync(SCHEMA, next);
    console.log(`[db] schema provider → ${provider}`);
  }
  return provider;
}
