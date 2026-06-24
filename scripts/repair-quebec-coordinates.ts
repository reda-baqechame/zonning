/**
 * Repair integer-collapsed permit coordinates against the PRODUCTION database,
 * using a raw `pg` connection (the local generated Prisma client is built for
 * SQLite and cannot target Postgres; production is regenerated for Postgres
 * during the Vercel build).
 *
 * The old parseLocaleNumber heuristic mangled high-precision WGS84 decimals
 * (e.g. "46.75216566177939") into huge integers (4675216566177939). This
 * script finds Permit rows whose lat/lon is outside the valid WGS84 range and
 * repairs them in place; irreparable values are nulled.
 *
 * Usage: npx tsx scripts/repair-quebec-coordinates.ts
 */
import { loadProdEnv } from "./load-prod-env";

loadProdEnv();
const url: string =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "";

if (!url || url.startsWith("file:")) {
  console.error("No production Postgres URL found (POSTGRES_PRISMA_URL). Aborting.");
  process.exit(1);
}

import pg from "pg";
import { repairIntegerCollapsed, isValidCoordinate } from "../src/lib/permits/coordinate";

async function main() {
  console.log("Connecting to:", new URL(url).hostname);
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });

  const { rows } = await pool.query(
    `SELECT id, latitude, longitude, city FROM "Permit"
     WHERE latitude > 90 OR latitude < -90
        OR longitude > 180 OR longitude < -180`,
  );
  console.log(`Found ${rows.length} permits with out-of-range coordinates.`);

  let fixed = 0;
  let nulled = 0;
  for (const r of rows) {
    const lat =
      r.latitude != null ? repairIntegerCollapsed(Number(r.latitude), "lat") : null;
    const lon =
      r.longitude != null ? repairIntegerCollapsed(Number(r.longitude), "lon") : null;
    if (lat != null && lon != null && isValidCoordinate(lat, lon)) {
      await pool.query(
        `UPDATE "Permit" SET latitude = $1, longitude = $2 WHERE id = $3`,
        [lat, lon, r.id],
      );
      fixed++;
    } else {
      await pool.query(
        `UPDATE "Permit" SET latitude = NULL, longitude = NULL WHERE id = $3`,
        [r.id],
      ).catch(() => {});
      nulled++;
    }
  }

  console.log(`Repaired ${fixed} coordinates; nulled ${nulled} irreparable rows.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
