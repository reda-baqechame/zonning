import { Prisma } from "@/generated/prisma/client";
import { prisma, isPostgres } from "@/lib/prisma";
import { haversineKm } from "@/lib/datasets/geo";

let postgisAvailable: boolean | null = null;

export async function isPostgisEnabled(): Promise<boolean> {
  if (!isPostgres()) return false;
  if (process.env.POSTGIS_ENABLED === "false") return false;
  if (postgisAvailable !== null) return postgisAvailable;
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS exists
    `;
    postgisAvailable = Boolean(rows[0]?.exists);
  } catch {
    postgisAvailable = false;
  }
  return postgisAvailable;
}

type ContaminatedRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
  sourceLayer: string | null;
  borough: string | null;
};

export async function findContaminatedNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  opts?: { sourceLayer?: string; borough?: string; limit?: number }
): Promise<ContaminatedRow[]> {
  const limit = opts?.limit ?? 50;
  const radiusM = radiusKm * 1000;

  if (await isPostgisEnabled()) {
    try {
      const filters = [
        Prisma.sql`latitude IS NOT NULL AND longitude IS NOT NULL`,
        Prisma.sql`ST_DWithin(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusM}
        )`,
      ];
      if (opts?.sourceLayer) {
        filters.push(Prisma.sql`"sourceLayer" = ${opts.sourceLayer}`);
      }
      if (opts?.borough) {
        filters.push(Prisma.sql`borough = ${opts.borough}`);
      }

      return await prisma.$queryRaw<ContaminatedRow[]>`
        SELECT id, latitude, longitude, status, "sourceLayer", borough
        FROM "ContaminatedSite"
        WHERE ${Prisma.join(filters, " AND ")}
        LIMIT ${limit}
      `;
    } catch {
      postgisAvailable = false;
    }
  }

  const sites = await prisma.contaminatedSite.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      ...(opts?.sourceLayer ? { sourceLayer: opts.sourceLayer } : {}),
      ...(opts?.borough ? { borough: opts.borough } : {}),
    },
    take: opts?.sourceLayer === "gtc" ? 8000 : 400,
  });

  return sites
    .filter((s) => {
      if (s.latitude == null || s.longitude == null) return false;
      return haversineKm(lat, lng, s.latitude, s.longitude) <= radiusKm;
    })
    .slice(0, limit);
}

type ZoningRow = {
  id: string;
  latitude: number;
  longitude: number;
  landUse: string | null;
  intensificationLevel: string | null;
  description: string | null;
  densityThreshold: number | null;
  zoneCode: string | null;
  sourceUrl: string;
  sourceFetchedAt: Date;
  city: string | null;
  distanceMeters: number;
};

export async function findNearestZoningPoint(
  lat: number,
  lng: number,
  city?: string,
  maxKm = 0.25
): Promise<ZoningRow | null> {
  if (await isPostgisEnabled()) {
    try {
      const cityFilter = city
        ? Prisma.sql`AND city = ${city}`
        : Prisma.empty;

      const rows = await prisma.$queryRaw<ZoningRow[]>`
        SELECT id, latitude, longitude, "landUse", "intensificationLevel", description,
               "densityThreshold", "zoneCode", "sourceUrl", "sourceFetchedAt", city,
               ST_Distance(
                 ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
                 ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
               ) AS "distanceMeters"
        FROM "ZoningPoint"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ${cityFilter}
        ORDER BY ST_Distance(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        )
        LIMIT 1
      `;
      const hit = rows[0];
      if (!hit) return null;
      return hit.distanceMeters <= maxKm * 1000 ? hit : null;
    } catch {
      postgisAvailable = false;
    }
  }

  const points = await prisma.zoningPoint.findMany({
    where: city ? { city } : undefined,
    take: 5000,
  });
  let best: (typeof points)[0] | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    const d = haversineKm(lat, lng, p.latitude, p.longitude);
    if (d < bestDist && d <= maxKm) {
      bestDist = d;
      best = p;
    }
  }
  return best ? { ...best, distanceMeters: Math.round(bestDist * 1000) } : null;
}

type HeritageRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  name: string | null;
  category: string | null;
  externalId: string | null;
  borough: string | null;
};

export async function findHeritageNearby(
  lat: number,
  lng: number,
  radiusKm: number,
  borough?: string,
  limit = 20
): Promise<HeritageRow[]> {
  const radiusM = radiusKm * 1000;

  if (await isPostgisEnabled()) {
    try {
      const boroughFilter = borough
        ? Prisma.sql`AND borough = ${borough}`
        : Prisma.empty;

      return await prisma.$queryRaw<HeritageRow[]>`
        SELECT id, latitude, longitude, name, category, "externalId", borough
        FROM "HeritageSite"
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        ${boroughFilter}
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
          ${radiusM}
        )
        LIMIT ${limit}
      `;
    } catch {
      postgisAvailable = false;
    }
  }

  const sites = await prisma.heritageSite.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      ...(borough ? { borough } : {}),
    },
    take: 400,
  });

  return sites
    .filter((h) => {
      if (h.latitude == null || h.longitude == null) return false;
      return haversineKm(lat, lng, h.latitude, h.longitude) <= radiusKm;
    })
    .slice(0, limit);
}
