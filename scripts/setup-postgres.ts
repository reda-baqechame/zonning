import "dotenv/config";
import { execSync } from "child_process";
import { ensureDbProvider, isPostgresUrl } from "./ensure-db-provider";
import { loadProdEnv } from "./load-prod-env";
import { resolveDatabaseUrl, resolveDirectDatabaseUrl } from "../src/lib/env-resolve";

loadProdEnv();

/**
 * One-shot Postgres setup: schema push + PostGIS spatial indexes.
 */
async function main() {
  const url = resolveDatabaseUrl() ?? "";
  if (!isPostgresUrl(url)) {
    console.error("Postgres URL required (DATABASE_URL or POSTGRES_PRISMA_URL from Supabase integration)");
    process.exit(1);
  }

  const directUrl = resolveDirectDatabaseUrl() ?? url;
  process.env.DATABASE_URL = directUrl;
  ensureDbProvider(url);

  console.log("Pushing Prisma schema to Postgres (direct connection)...");
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit", env: process.env });

  if (process.env.SKIP_POSTGIS === "1") {
    console.log("\n✓ Postgres schema ready (PostGIS skipped — set POSTGIS later via npm run db:postgis)");
    return;
  }

  console.log("\nApplying PostGIS scaffold...");
  try {
    execSync("npx tsx scripts/apply-postgis.ts", { stdio: "inherit", env: process.env });
    console.log("\n✓ Postgres ready (schema + PostGIS)");
  } catch {
    console.warn("\n⚠ PostGIS scaffold failed — schema is ready; run npm run db:postgis on Supabase later.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
