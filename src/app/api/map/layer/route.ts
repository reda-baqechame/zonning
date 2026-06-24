import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/api-guard";

export type MapLayerPoint = {
  id: string;
  lat: number;
  lng: number;
  label?: string | null;
};

const LAYERS = new Set(["contamination", "heritage", "zoning", "roadworks"]);

function bboxCentroid(minLat: number, maxLat: number, minLng: number, maxLng: number) {
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:map:layer", 60, 60_000);
  if (limited) return limited;

  const layer = req.nextUrl.searchParams.get("layer") ?? "";
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  const limit = Math.min(
    800,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "500", 10) || 500),
  );

  if (!LAYERS.has(layer)) {
    return NextResponse.json({ error: "layer must be contamination, heritage, zoning, or roadworks" }, { status: 400 });
  }

  const points: MapLayerPoint[] = [];

  if (layer === "contamination") {
    const sites = await prisma.contaminatedSite.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        sourceLayer: "gtc",
        ...(city ? { borough: { contains: city.slice(0, 8) } } : {}),
      },
      take: limit,
      select: { id: true, latitude: true, longitude: true, address: true, status: true },
      orderBy: { sourceFetchedAt: "desc" },
    });
    for (const s of sites) {
      if (s.latitude == null || s.longitude == null) continue;
      points.push({
        id: s.id,
        lat: s.latitude,
        lng: s.longitude,
        label: s.address ?? s.status,
      });
    }
  }

  if (layer === "heritage") {
    const sites = await prisma.heritageSite.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(city ? { borough: { contains: city.slice(0, 8) } } : {}),
      },
      take: limit,
      select: { id: true, latitude: true, longitude: true, name: true, category: true },
      orderBy: { sourceFetchedAt: "desc" },
    });
    for (const s of sites) {
      if (s.latitude == null || s.longitude == null) continue;
      points.push({
        id: s.id,
        lat: s.latitude,
        lng: s.longitude,
        label: s.name ?? s.category,
      });
    }
  }

  if (layer === "zoning") {
    const zoningPoints = await prisma.zoningPoint.findMany({
      where: city ? { city } : undefined,
      take: Math.floor(limit * 0.6),
      select: {
        id: true,
        latitude: true,
        longitude: true,
        zoneCode: true,
        landUse: true,
        intensificationLevel: true,
      },
      orderBy: { sourceFetchedAt: "desc" },
    });
    for (const z of zoningPoints) {
      points.push({
        id: z.id,
        lat: z.latitude,
        lng: z.longitude,
        label: z.zoneCode ?? z.landUse ?? z.intensificationLevel,
      });
    }

    const polyCap = limit - points.length;
    if (polyCap > 0) {
      const polygons = await prisma.zoningPolygon.findMany({
        where: {
          minLat: { not: null },
          maxLat: { not: null },
          minLng: { not: null },
          maxLng: { not: null },
        },
        take: polyCap,
        select: {
          id: true,
          zoneCode: true,
          minLat: true,
          maxLat: true,
          minLng: true,
          maxLng: true,
        },
        orderBy: { sourceFetchedAt: "desc" },
      });
      for (const p of polygons) {
        if (
          p.minLat == null ||
          p.maxLat == null ||
          p.minLng == null ||
          p.maxLng == null
        ) {
          continue;
        }
        const c = bboxCentroid(p.minLat, p.maxLat, p.minLng, p.maxLng);
        points.push({ id: p.id, lat: c.lat, lng: c.lng, label: p.zoneCode });
      }
    }
  }

  if (layer === "roadworks") {
    const works = await prisma.roadWork.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(city ? { city } : {}),
      },
      take: limit,
      select: { id: true, latitude: true, longitude: true, title: true, borough: true },
      orderBy: { sourceFetchedAt: "desc" },
    });
    for (const w of works) {
      if (w.latitude == null || w.longitude == null) continue;
      points.push({
        id: w.id,
        lat: w.latitude,
        lng: w.longitude,
        label: w.title ?? w.borough,
      });
    }
  }

  return NextResponse.json({ layer, count: points.length, points });
}
