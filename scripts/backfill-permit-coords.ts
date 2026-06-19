/**
 * Backfill missing permit lat/lng via geocoding.
 * Usage: npx tsx scripts/backfill-permit-coords.ts [--limit=200]
 */
import { prisma } from "../src/lib/prisma";
import { resolveCoordinatesForAddress } from "../src/lib/geocode";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "200", 10) : 200;

  const permits = await prisma.permit.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    orderBy: { issueDate: "desc" },
    take: limit,
    select: { id: true, address: true, borough: true, city: true },
  });

  console.log(`Geocoding ${permits.length} permits…`);
  let updated = 0;

  for (const p of permits) {
    const coords = await resolveCoordinatesForAddress(
      p.address,
      p.borough ?? undefined,
      p.city ?? "Montréal"
    );
    if (!coords) continue;
    await prisma.permit.update({
      where: { id: p.id },
      data: { latitude: coords.latitude, longitude: coords.longitude },
    });
    updated++;
    if (updated % 25 === 0) console.log(`  ${updated} updated…`);
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done: ${updated}/${permits.length} permits geocoded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
