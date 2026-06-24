import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic endpoint. Returns the raw runtime type/value of a
 * permit's latitude as the production serverless function sees it, so we can
 * pinpoint where coordinate mangling originates. DELETE after debugging.
 */
export async function GET() {
  const row = await prisma.permit.findFirst({
    where: { city: "Québec", latitude: { not: null } },
    select: { id: true, latitude: true, longitude: true },
  });
  if (!row) return NextResponse.json({ found: false });
  return NextResponse.json({
    id: row.id,
    typeofLatitude: typeof row.latitude,
    rawLatitude: row.latitude,
    jsonLatitude: JSON.stringify(row.latitude),
    stringLatitude: String(row.latitude),
    isFinite: Number.isFinite(row.latitude as number),
    longitude: row.longitude,
    pgVersion: typeof process.versions,
  });
}
