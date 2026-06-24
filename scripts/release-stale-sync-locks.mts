import { loadProdEnv } from "./load-prod-env";
import { resolveDatabaseUrl } from "../src/lib/env-resolve";

loadProdEnv({ productionOnly: true });

async function main() {
  const url = resolveDatabaseUrl();
  if (!url?.includes("postgres")) {
    console.error("Postgres DATABASE_URL required");
    process.exit(1);
  }
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: /supabase\.(com|co)/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  const stuck = ["rena", "market-index", "registre-entreprises"];
  const result = await pool.query(
    `UPDATE "SyncState" SET status = 'idle', "lastError" = 'Released stale lock for re-sync' WHERE "datasetId" = ANY($1::text[]) AND status = 'running'`,
    [stuck],
  );
  console.log("released", result.rowCount);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
