import { prisma } from "@/lib/prisma";
import { normalizeAddress } from "@/lib/datasets/parser";
import { fetchWithRetry } from "@/lib/http/resilience";

const ICHERCHE_BASE =
  process.env.ICHERCHE_GEOCODE_URL ??
  "https://geoegl.msp.gouv.qc.ca/apis/icherche/geocode";

export type ResolvedCoordinates = {
  latitude: number;
  longitude: number;
  source: "permit" | "icherche" | "osm";
  city?: string;
};

type IChercheFeature = {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: { nom?: string; municipalite?: string; confiance?: number };
};

async function geocodeWithICherche(
  address: string,
  city?: string
): Promise<ResolvedCoordinates | null> {
  const query = [address, city].filter(Boolean).join(", ");
  const url = `${ICHERCHE_BASE}?type=adresses&q=${encodeURIComponent(query)}&limit=1&geometry=true`;

  try {
    const res = await fetchWithRetry(url, undefined, { retries: 1, timeoutMs: 12_000 });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      features?: IChercheFeature[];
      type?: string;
    };

    const feature = data.features?.[0];
    const coords = feature?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;

    const longitude = coords[0];
    const latitude = coords[1];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    const municipalite = feature?.properties?.municipalite;
    return {
      latitude,
      longitude,
      source: "icherche",
      city: municipalite || undefined,
    };
  } catch {
    return null;
  }
}

async function geocodeWithOsm(
  address: string,
  borough?: string,
  city?: string
): Promise<ResolvedCoordinates | null> {
  const query = [address, borough, city ?? "Montréal", "Québec", "Canada"]
    .filter(Boolean)
    .join(", ");
  const res = await fetchWithRetry(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { "User-Agent": "ZONNING/1.0 (https://zonning.ca)" } },
    { retries: 1, timeoutMs: 10_000 }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const hit = data[0];
  if (!hit?.lat || !hit.lon) return null;
  const latitude = parseFloat(hit.lat);
  const longitude = parseFloat(hit.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, source: "osm" };
}

export async function resolveCoordinatesForAddress(
  address: string,
  borough?: string,
  city?: string
): Promise<ResolvedCoordinates | null> {
  const norm = normalizeAddress(address);
  const streetPart = norm.split(" ").slice(1).join(" ") || norm;
  const needle = streetPart.length > 4 ? streetPart.slice(0, 18) : norm.slice(0, 18);

  const permit = await prisma.permit.findFirst({
    where: {
      address: { contains: needle },
      ...(borough ? { borough } : {}),
      ...(city ? { city } : {}),
      latitude: { not: null },
      longitude: { not: null },
    },
    orderBy: { issueDate: "desc" },
  });
  if (permit?.latitude != null && permit.longitude != null) {
    return {
      latitude: permit.latitude,
      longitude: permit.longitude,
      source: "permit",
      city: permit.city ?? undefined,
    };
  }

  if (process.env.GEOCODE_ENABLED === "false") return null;

  const icherche = await geocodeWithICherche(address, city ?? borough);
  if (icherche) return icherche;

  try {
    return await geocodeWithOsm(address, borough, city);
  } catch {
    return null;
  }
}
