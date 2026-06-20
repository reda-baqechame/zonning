import { prisma } from "@/lib/prisma";
import { resolveCoordinatesForAddress } from "@/lib/geocode";
import { RGM_CITIES } from "@/lib/quebec-coverage";
import { hasUsableAddress } from "@/lib/permits/quality";

const geocodeInFlight = new Set<string>();

/**
 * Geocode permits missing coordinates after ingest — RGM cities first.
 * Non-blocking; rate-limited to protect iCherche/OSM quotas.
 */
export async function geocodePermitsWithoutCoords(options?: {
  cities?: string[];
  limit?: number;
}): Promise<number> {
  const cities = options?.cities ?? [...RGM_CITIES, "Québec", "Gatineau"];
  const limit = options?.limit ?? 25;

  const permits = await prisma.permit.findMany({
    where: {
      city: { in: cities },
      OR: [{ latitude: null }, { longitude: null }],
      address: { not: "" },
    },
    orderBy: { issueDate: "desc" },
    take: limit,
    select: { id: true, address: true, borough: true, city: true },
  });

  let updated = 0;
  for (const p of permits) {
    if (!hasUsableAddress(p.address, p.city)) continue;
    if (geocodeInFlight.has(p.id)) continue;
    geocodeInFlight.add(p.id);
    try {
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
      await new Promise((r) => setTimeout(r, 180));
    } finally {
      geocodeInFlight.delete(p.id);
    }
  }
  return updated;
}

export function scheduleGeocodeAfterPermitIngest(city?: string | null): void {
  if (process.env.GEOCODE_ON_INGEST === "false") return;
  const cities = city && (RGM_CITIES as readonly string[]).includes(city)
    ? [city]
    : [...RGM_CITIES];
  void geocodePermitsWithoutCoords({ cities, limit: city ? 25 : 15 }).catch(() => {});
}
