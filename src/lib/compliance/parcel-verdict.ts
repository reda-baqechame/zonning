import { prisma } from "@/lib/prisma";

/**
 * Parcel compliance verdict assembled from REAL indexed layers only:
 * ContaminatedSite (GTC) and HeritageSite. Replaces the generic "verify zoning"
 * limitation with an actual tri-state. A layer that errors degrades the verdict
 * to unknown_layer rather than fabricating a clear result.
 */

export type ParcelConstraint = {
  kind: "contamination" | "heritage" | "zoning";
  label: string;
  sourceUrl: string;
};

export type ParcelVerdict = {
  status: "clear" | "constraint_present" | "unknown_layer";
  constraints: ParcelConstraint[];
  note: string;
};

export type AssessDeps = {
  findContaminated: (
    lat: number,
    lon: number,
    radiusMeters: number,
  ) => Promise<{ id: string; name?: string | null; sourceUrl?: string | null }[]>;
  findHeritage: (
    lat: number,
    lon: number,
    radiusMeters: number,
  ) => Promise<{ id: string; name?: string | null; sourceUrl?: string | null }[]>;
  radiusMeters: number;
};

const CLEAR_FR =
  "Aucune contrainte indexée (contamination, patrimoine) à proximité immédiate.";
const CLEAR_EN =
  "No indexed constraint (contamination, heritage) found nearby.";

export async function assessParcel(
  lat: number,
  lon: number,
  deps: AssessDeps,
): Promise<ParcelVerdict> {
  const constraints: ParcelConstraint[] = [];
  let unknown = false;

  try {
    const sites = await deps.findContaminated(lat, lon, deps.radiusMeters);
    for (const s of sites.slice(0, 5)) {
      constraints.push({
        kind: "contamination",
        label: s.name ?? "Terrain contaminé (GTC)",
        sourceUrl:
          s.sourceUrl ??
          "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-terrains-contamines-gtc",
      });
    }
  } catch {
    unknown = true;
  }

  try {
    const herit = await deps.findHeritage(lat, lon, deps.radiusMeters);
    for (const h of herit.slice(0, 5)) {
      constraints.push({
        kind: "heritage",
        label: h.name ?? "Immeuble patrimonial indexé",
        sourceUrl:
          h.sourceUrl ??
          "https://www.donneesquebec.ca/recherche/dataset/vmtl-les-edifices-patrimoniaux-de-montreal",
      });
    }
  } catch {
    unknown = true;
  }

  if (unknown) {
    return {
      status: "unknown_layer",
      constraints,
      note: "Une couche réglementaire n'a pu être vérifiée ; confirmer zonage/contraintes à la source.",
    };
  }
  if (constraints.length > 0) {
    return {
      status: "constraint_present",
      constraints,
      note: `${constraints.length} contrainte(s) indexée(s) à proximité — vérifier l'incidence avant projet.`,
    };
  }
  return { status: "clear", constraints, note: `${CLEAR_FR} / ${CLEAR_EN}` };
}

/** Production dependency wiring. Uses a coarse bounding-box prefilter (fast). */
export function productionParcelDeps(radiusMeters = 500): AssessDeps {
  const deg = radiusMeters / 111_000; // ~meters to degrees, latitude approximation
  return {
    radiusMeters,
    findContaminated: async (lat, lon) => {
      // ContaminatedSite has no `name` column; use `description`/`address` as label.
      const rows = await prisma.contaminatedSite.findMany({
        where: {
          AND: [
            { latitude: { gte: lat - deg } },
            { latitude: { lte: lat + deg } },
            { longitude: { gte: lon - deg } },
            { longitude: { lte: lon + deg } },
          ],
        },
        select: { id: true, address: true, description: true, sourceUrl: true },
        take: 5,
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.description ?? r.address ?? null,
        sourceUrl: r.sourceUrl ?? null,
      }));
    },
    findHeritage: async (lat, lon) => {
      const rows = await prisma.heritageSite.findMany({
        where: {
          AND: [
            { latitude: { gte: lat - deg } },
            { latitude: { lte: lat + deg } },
            { longitude: { gte: lon - deg } },
            { longitude: { lte: lon + deg } },
          ],
        },
        select: { id: true, name: true, address: true, sourceUrl: true },
        take: 5,
      });
      return rows.map((r) => ({
        id: r.id,
        name: r.name ?? r.address ?? null,
        sourceUrl: r.sourceUrl ?? null,
      }));
    },
  };
}
