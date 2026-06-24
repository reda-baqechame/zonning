import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/api-guard";
import {
  findContaminatedNearby,
  findHeritageNearby,
  findNearestZoningPoint,
} from "@/lib/spatial";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/datasets/geo";

const RADIUS_KM = 2;

function polygonCentroid(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
): { lat: number; lng: number } {
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:map:overlays", 60, 60_000);
  if (limited) return limited;

  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  const layers = (req.nextUrl.searchParams.get("layers") ?? "gtc,heritage").split(",");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const points: { id: string; lat: number; lng: number; kind: "gtc" | "heritage" | "zoning" }[] =
    [];

  if (layers.includes("gtc")) {
    const gtcSites = await findContaminatedNearby(lat, lng, RADIUS_KM, {
      sourceLayer: "gtc",
      limit: 80,
    });
    for (const s of gtcSites) {
      if (s.latitude == null || s.longitude == null) continue;
      points.push({ id: s.id, lat: s.latitude, lng: s.longitude, kind: "gtc" });
    }
  }

  if (layers.includes("heritage")) {
    const heritage = await findHeritageNearby(lat, lng, RADIUS_KM, undefined, 60);
    for (const h of heritage) {
      if (h.latitude == null || h.longitude == null) continue;
      points.push({ id: h.id, lat: h.latitude, lng: h.longitude, kind: "heritage" });
    }
  }

  if (layers.includes("zoning")) {
    const nearest = await findNearestZoningPoint(lat, lng, undefined, RADIUS_KM);
    if (nearest) {
      points.push({
        id: nearest.id,
        lat: nearest.latitude,
        lng: nearest.longitude,
        kind: "zoning",
      });
    }

    const polygons = await prisma.zoningPolygon.findMany({
      where: {
        minLat: { lte: lat },
        maxLat: { gte: lat },
        minLng: { lte: lng },
        maxLng: { gte: lng },
      },
      take: 40,
      select: { id: true, minLat: true, maxLat: true, minLng: true, maxLng: true },
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
      const c = polygonCentroid(p.minLat, p.maxLat, p.minLng, p.maxLng);
      if (haversineKm(lat, lng, c.lat, c.lng) <= RADIUS_KM) {
        points.push({ id: p.id, lat: c.lat, lng: c.lng, kind: "zoning" });
      }
    }
  }

  return NextResponse.json({ points: points.slice(0, 80) });
}
