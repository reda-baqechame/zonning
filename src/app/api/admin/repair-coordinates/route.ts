import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { repairIntegerCollapsed, isValidCoordinate } from "@/lib/permits/coordinate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Server-side coordinate repair. Finds Permit rows whose lat/lon is outside
 * the valid WGS84 range (mangled by the old parseLocaleNumber heuristic) and
 * repairs them in place; irreparable values are nulled.
 *
 * Runs on the production runtime where the Postgres connection works cleanly
 * (local scripts hit a TLS/MITM chain issue against the Supabase pooler).
 * Protected by the same CRON_SECRET as the sync endpoints.
 */
export async function POST(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  let fixed = 0;
  let nulled = 0;
  const sample: { id: string; before: number; after: number | null }[] = [];

  for (const r of rows) {
    const lat =
      r.latitude != null ? repairIntegerCollapsed(r.latitude, "lat") : null;
    const lon =
      r.longitude != null ? repairIntegerCollapsed(r.longitude, "lon") : null;
    if (lat != null && lon != null && isValidCoordinate(lat, lon)) {
      await prisma.permit.update({
        where: { id: r.id },
        data: { latitude: lat, longitude: lon },
      });
      fixed++;
      if (sample.length < 3 && r.latitude != null) {
        sample.push({ id: r.id, before: r.latitude, after: lat });
      }
    } else {
      await prisma.permit
        .update({ where: { id: r.id }, data: { latitude: null, longitude: null } })
        .catch(() => {});
      nulled++;
    }
  }

  return NextResponse.json({
    ok: true,
    found: rows.length,
    fixed,
    nulled,
    sample,
  });
}
