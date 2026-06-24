/**
 * Repair integer-collapsed permit coordinates.
 *
 * The old parseLocaleNumber heuristic mangled high-precision WGS84 decimals
 * (e.g. "46.75216566177939" from Ville de Québec) into huge integers
 * (4675216566177939). This script finds any Permit row whose lat/lon is
 * outside the valid WGS84 range and repairs it in place.
 *
 * Usage: npx tsx scripts/repair-quebec-coordinates.ts   (uses .env / .env.production.local)
 */
import { prisma } from "../src/lib/prisma";
import { repairIntegerCollapsed, isValidCoordinate } from "../src/lib/permits/coordinate";

async function main() {
  const rows = await prisma.permit.findMany({
    where: {
      OR: [
        { latitude: { gt: 90 } },
        { latitude: { lt: -90 } },
        { longitude: { gt: 180 } },
        { longitude: { lt: -180 } },
      ],
    },
    select: { id: true, latitude: true, longitude: true, city: true },
  });

  console.log(`Found ${rows.length} permits with out-of-range coordinates.`);
  let fixed = 0;
  let failed = 0;

  for (const r of rows) {
    const lat = r.latitude != null ? repairIntegerCollapsed(r.latitude, "lat") : null;
    const lon = r.longitude != null ? repairIntegerCollapsed(r.longitude, "lon") : null;
    if (lat != null && lon != null && isValidCoordinate(lat, lon)) {
      await prisma.permit.update({
        where: { id: r.id },
        data: { latitude: lat, longitude: lon },
      });
      fixed++;
    } else {
      // Null out irreparable garbage so the map/geo filtering isn't misled.
      await prisma.permit
        .update({ where: { id: r.id }, data: { latitude: null, longitude: null } })
        .catch(() => {});
      failed++;
    }
  }

  console.log(`Repaired ${fixed} coordinates; nulled ${failed} irreparable rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
