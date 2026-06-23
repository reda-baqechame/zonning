import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { profileFromUser } from "@/lib/quebec-qualification";

const profileSchema = z.object({
  companyName: z.string().trim().max(160).optional(),
  trades: z.array(z.string().trim().max(80)).optional(),
  productsOrServices: z.array(z.string().trim().max(80)).optional(),
  rbqLicenseNumber: z.string().trim().max(40).optional().nullable(),
  rbqLicenseClasses: z.array(z.string().trim().max(80)).optional(),
  regions: z.array(z.string().trim().max(80)).optional(),
  municipalities: z.array(z.string().trim().max(80)).optional(),
  minJobValue: z.number().nonnegative().nullable().optional(),
  maxJobValue: z.number().nonnegative().nullable().optional(),
  ampAuthorized: z.boolean().optional(),
  capacityNotes: z.string().trim().max(600).optional().nullable(),
});

async function limit(req: NextRequest, userId: string) {
  const limited = await rateLimitAsync(
    `api:v2:company-profile:${userId}:${clientIp(req)}`,
    60,
    60_000,
  );
  return limited.ok ? null : rateLimitResponse(limited.retryAfterSec);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await limit(req, user.id);
    if (limited) return limited;
    return NextResponse.json({ profile: profileFromUser(user, req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr") });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const limited = await limit(req, user.id);
    if (limited) return limited;
    const body = profileSchema.parse(await req.json());
    const trades = body.trades?.length ? body.trades : body.productsOrServices;
    const regions = body.regions?.length ? body.regions : body.municipalities;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.companyName !== undefined ? { companyName: body.companyName } : {}),
        ...(trades !== undefined ? { trades: JSON.stringify(trades) } : {}),
        ...(regions !== undefined ? { regions: JSON.stringify(regions) } : {}),
        ...(body.rbqLicenseNumber !== undefined ? { rbqLicenseNumber: body.rbqLicenseNumber } : {}),
        ...(body.rbqLicenseClasses !== undefined ? { rbqLicenseClass: body.rbqLicenseClasses.join(", ") } : {}),
        ...(body.minJobValue !== undefined ? { minProjectCost: body.minJobValue } : {}),
        ...(body.maxJobValue !== undefined ? { maxProjectCost: body.maxJobValue } : {}),
        ...(body.ampAuthorized !== undefined ? { ampAuthorized: body.ampAuthorized } : {}),
      },
    });
    return NextResponse.json({ profile: profileFromUser(updated, req.nextUrl.searchParams.get("locale") === "en" ? "en" : "fr") });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Invalid profile" }, { status });
  }
}
