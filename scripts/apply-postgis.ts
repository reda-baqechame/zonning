import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { loadProdEnv } from "./load-prod-env";
import { resolveDirectDatabaseUrl } from "../src/lib/env-resolve";

loadProdEnv();

/**
 * Apply PostGIS scaffold on Supabase/Postgres (production cutover).
 * Usage: DATABASE_URL=postgresql://... npm run db:postgis
 */
async function main() {
  const url = resolveDirectDatabaseUrl();
  if (!url?.startsWith("postgres")) {
    console.error("DATABASE_URL must be a PostgreSQL connection string");
    process.exit(1);
  }

  const sqlPath = join(process.cwd(), "prisma", "postgis-scaffold.sql");
  const sql = readFileSync(sqlPath, "utf8");
  const connectionString = url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, "");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Applying PostGIS scaffold...");
    await pool.query(sql);
    console.log("✓ PostGIS extension and spatial indexes applied");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
