import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildSiteDossier } from "@/lib/api/v2";
import {
  enforceV2RateLimit,
  isV2Access,
  requireV2Access,
} from "@/lib/api/v2-access";

const requestSchema = z.object({
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(120).optional(),
  borough: z.string().trim().min(2).max(120).optional(),
  project: z
    .object({
      desiredUse: z.string().trim().min(2).max(160).optional(),
      proposedFloors: z.number().int().positive().max(500).optional(),
      proposedUnits: z.number().int().positive().max(10_000).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const access = await requireV2Access(req, "verdict");
  if (!isV2Access(access)) return access;
  const limited = await enforceV2RateLimit(req, "reports", access, 30);
  if (limited) return limited;

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid report request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const dossier = await buildSiteDossier({
    address: body.address,
    city: body.city,
    borough: body.borough,
    project: body.project,
  });
  if (dossier.signals.length === 0 && dossier.permits.length === 0) {
    return NextResponse.json(
      {
        error: "No verified evidence matched this address.",
        report: dossier,
      },
      { status: 422 }
    );
  }
  return NextResponse.json({
    report: dossier,
    product: "intelligence_dossier",
    status: "generated",
    disclaimer: "Operational intelligence only. Not legal authorization, legal advice, or a municipal filing.",
  });
}
