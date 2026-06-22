import CarteClient, { type LayerInfo } from "./CarteClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Dedicated map page. Honest about each layer's availability: the permit layer
 * is a real (point) map; the others are labelled with what we actually have
 * (point coverage, document-only, or none) rather than implying full polygon
 * map intelligence we don't yet render.
 */
export default async function CartePage() {
  const [permits, mappablePermits, tenders, zoningPoints, zoningPolygons, contamination, heritage, roadworks] =
    await Promise.all([
      prisma.permit.count(),
      prisma.permit.count({ where: { latitude: { not: null }, longitude: { not: null } } }),
      prisma.tender.count(),
      prisma.zoningPoint.count(),
      prisma.zoningPolygon.count(),
      prisma.contaminatedSite.count(),
      prisma.heritageSite.count(),
      prisma.roadWork.count(),
    ]);

  const mapAvailable = (count: number) => (count > 0 ? "AVAILABLE" : "NONE");

  const layers: LayerInfo[] = [
    { key: "permits", count: permits, mappable: mappablePermits, status: mapAvailable(mappablePermits), mapped: true },
    { key: "tenders", count: tenders, mappable: 0, status: tenders > 0 ? "LIST_ONLY" : "NONE", mapped: false },
    {
      key: "zoning",
      count: zoningPoints,
      mappable: zoningPoints,
      // Polygons = true coverage; points alone are a fallback reference only.
      status: zoningPolygons > 0 ? "PARTIAL" : zoningPoints > 0 ? "POINT_ONLY" : "NONE",
      mapped: true,
      polygons: zoningPolygons,
    },
    { key: "contamination", count: contamination, mappable: contamination, status: mapAvailable(contamination), mapped: true },
    { key: "heritage", count: heritage, mappable: heritage, status: mapAvailable(heritage), mapped: true },
    { key: "roadworks", count: roadworks, mappable: roadworks, status: mapAvailable(roadworks), mapped: true },
  ];

  return <CarteClient layers={layers} />;
}
