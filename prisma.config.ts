import "dotenv/config";
import { defineConfig } from "prisma/config";

function databaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
  ]
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
