/**
 * Coordinate parsing for WGS84 lat/lon.
 *
 * The generic `parseLocaleNumber` (in datasets/parser.ts) mis-parses
 * high-precision decimals like "46.75216566177939" (Ville de Québec open data):
 * it treats the dot as a thousands separator (since there are >2 trailing
 * digits) and concatenates into a huge integer (4675216566177939). Coordinates
 * must be parsed explicitly as decimals, never with locale heuristics.
 */

/** Parse a coordinate string as a plain decimal. Undefined if not numeric. */
export function parseCoordinate(
  value: string | number | null | undefined,
): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const clean = value.trim().replace(/[^0-9.\-]/g, "");
  if (!clean || !/^-?\d+(\.\d+)?$/.test(clean)) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Repair a value that was mangled by `parseLocaleNumber` (integer-collapsed
 * decimal). Returns the repaired decimal, or undefined if the value is already
 * a plausible coordinate and needs no repair.
 *
 * Strategy: Québec lat is ~45-48, lon ~-57 to -79. An integer like
 * 4675216566177939 has the real value "hidden" by shifting the decimal. We
 * shift the decimal point left until the magnitude lands in a 2-digit leading
 * value (e.g. 46.xx), which is correct for Québec latitudes/longitudes.
 */
export function repairIntegerCollapsed(
  value: number,
  axis: "lat" | "lon",
): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const limit = axis === "lat" ? 90 : 180;
  if (Math.abs(value) <= limit) return undefined; // already plausible

  const sign = value < 0 ? -1 : 1;
  const mag = Math.abs(value);
  // 2 leading digits for both Québec lat (46) and lon (71) — both fit in 2.
  const targetLeadingDigits = 2;
  const exp = Number(mag.toExponential().split("e")[1]);
  const shift = exp - (targetLeadingDigits - 1);
  const repaired = mag / Math.pow(10, shift);
  const candidate = sign * repaired;
  if (Math.abs(candidate) <= limit) return candidate;
  return undefined;
}

/** True only when both values are valid WGS84 numbers within range. */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}
