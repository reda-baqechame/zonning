import { NextRequest } from "next/server";
import { z } from "zod";

const siteQuerySchema = z.object({
  id: z.string().trim().min(1).max(300),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(120).optional(),
  borough: z.string().trim().min(2).max(120).optional(),
});

export function parseV2SiteQuery(req: NextRequest, id: string) {
  const fallbackAddress = id.replace(/^site_/, "");
  return siteQuerySchema.safeParse({
    id,
    address: req.nextUrl.searchParams.get("address") ?? fallbackAddress,
    city: req.nextUrl.searchParams.get("city") ?? undefined,
    borough: req.nextUrl.searchParams.get("borough") ?? undefined,
  });
}

export function parsePositiveSiteInt(value: string | null, max: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= max ? parsed : undefined;
}
