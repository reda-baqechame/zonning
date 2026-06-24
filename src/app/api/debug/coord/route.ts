import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic. Tests whether a FULL-ROW permit query (no select:,
 * like /api/permits uses) returns a mangled latitude while a select: query
 * returns correct. DELETE after debugging.
 */
export async function GET() {
  const full = await prisma.permit.findFirst({
    where: { city: "Québec", latitude: { not: null } },
    orderBy: { issueDate: "desc" },
  });
  const slim = await prisma.permit.findFirst({
    where: { city: "Québec", latitude: { not: null } },
    orderBy: { issueDate: "desc" },
    select: { id: true, latitude: true, longitude: true },
  });

  const fullSerialized = JSON.parse(JSON.stringify(full));
  return NextResponse.json({
    fullRow: {
      id: full?.id,
      typeofLat: typeof full?.latitude,
      rawLat: full?.latitude,
      serializedLat: fullSerialized?.latitude,
    },
    slimRow: {
      id: slim?.id,
      typeofLat: typeof slim?.latitude,
      rawLat: slim?.latitude,
      serializedLat: JSON.parse(JSON.stringify(slim))?.latitude,
    },
  });
}
