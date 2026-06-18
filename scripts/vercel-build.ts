import { execSync } from "child_process";
import { ensureDbProvider, isPostgresUrl } from "./ensure-db-provider";
import { resolveDatabaseUrl, resolveDirectDatabaseUrl } from "../src/lib/env-resolve";

/**
 * Vercel build: Postgres uses db push; SQLite uses migrate deploy.
 */
const url = resolveDatabaseUrl() ?? "";
const isPostgres = isPostgresUrl(url);

function run(cmd: string) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

if (isPostgres) {
  process.env.DATABASE_URL = resolveDirectDatabaseUrl() ?? url;
}

ensureDbProvider(url);
run("npx prisma generate");

if (isPostgres) {
  run("npx prisma db push --accept-data-loss");
} else if (url.startsWith("file:")) {
  run("npx prisma migrate deploy");
}

run("npx next build");
