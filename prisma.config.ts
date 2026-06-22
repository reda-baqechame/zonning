import "dotenv/config";
import { defineConfig } from "prisma/config";

function databaseUrl(): string | undefined {
  // Explicit DATABASE_URL wins (Prisma convention) so local CLI usage targets
  // SQLite (file:./dev.db) even when Postgres marketplace vars are present.
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) return explicit;

  const candidates = [process.env.POSTGRES_PRISMA_URL, process.env.POSTGRES_URL]
    .map((s) => s?.trim())
    .filter(Boolean) as string[];
  const postgres = candidates.find(
    (u) => u.startsWith("postgres://") || u.startsWith("postgresql://")
  );
  return postgres ?? candidates[0];
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl(),
  },
});
