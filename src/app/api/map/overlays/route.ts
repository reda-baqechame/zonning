import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/datasets/geo";
import { enforceRateLimit } from "@/lib/api-guard";

const RADIUS_KM = 2;

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
    const gtcSites = await prisma.contaminatedSite.findMany({
      where: { sourceLayer: "gtc", latitude: { not: null }, longitude: { not: null } },
      take: 500,
      select: { id: true, latitude: true, longitude: true },
    });
    for (const s of gtcSites) {
      if (s.latitude == null || s.longitude == null) continue;
      if (haversineKm(lat, lng, s.latitude, s.longitude) <= RADIUS_KM) {
        points.push({ id: s.id, lat: s.latitude, lng: s.longitude, kind: "gtc" });
      }
    }
  }

  if (layers.includes("heritage")) {
    const heritage = await prisma.heritageSite.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      take: 400,
      select: { id: true, latitude: true, longitude: true },
    });
    for (const h of heritage) {
      if (h.latitude == null || h.longitude == null) continue;
      if (haversineKm(lat, lng, h.latitude, h.longitude) <= RADIUS_KM) {
        points.push({ id: h.id, lat: h.latitude, lng: h.longitude, kind: "heritage" });
      }
    }
  }

  if (layers.includes("zoning")) {
    const zoning = await prisma.zoningPoint.findMany({ take: 200 });
    for (const z of zoning) {
      if (haversineKm(lat, lng, z.latitude, z.longitude) <= RADIUS_KM) {
        points.push({ id: z.id, lat: z.latitude, lng: z.longitude, kind: "zoning" });
      }
    }
  }

  return NextResponse.json({ points: points.slice(0, 80) });
}
