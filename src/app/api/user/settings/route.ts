import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyAndUpdateUserRbq } from "@/lib/rbq-verify";
import { z } from "zod";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";
import { toPublicUser } from "@/lib/user-dto";
import { getIntegrationStatus } from "@/lib/env";

const schema = z.object({
  name: z.string().optional(),
  companyName: z.string().optional(),
  rbqLicenseClass: z.string().optional(),
  rbqLicenseNumber: z.string().optional(),
  trades: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  phone: z.string().optional(),
  ampAuthorized: z.boolean().optional(),
  minProjectCost: z.number().optional().nullable(),
  maxProjectCost: z.number().optional().nullable(),
  alertSmsEnabled: z.boolean().optional(),
  onboardingComplete: z.boolean().optional(),
  // Government Readiness Passport — tracked compliance profile.
  neq: z.string().optional().nullable(),
  revenuQuebecStatus: z.string().optional().nullable(),
  revenuQuebecExpiresAt: z.string().optional().nullable(),
  cnesstStatus: z.string().optional().nullable(),
  oqlfStatus: z.string().optional().nullable(),
  insuranceCarrier: z.string().optional().nullable(),
  insuranceExpiresAt: z.string().optional().nullable(),
  insuranceLimit: z.number().optional().nullable(),
  bidBondCapacity: z.number().optional().nullable(),
  lobbyismDeclarationOnFile: z.boolean().optional(),
  signingResolutionOnFile: z.boolean().optional(),
  referencesCount: z.number().optional().nullable(),
  employeesCount: z.number().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const ip = clientIp(req);
    const limited = await rateLimitAsync(`api:settings:${user.id}:${ip}`, 60, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
    return NextResponse.json({
      user: toPublicUser(user),
      integrations: getIntegrationStatus(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const ip = clientIp(req);
    const limited = await rateLimitAsync(`api:settings:${user.id}:${ip}`, 30, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const body = schema.parse(await req.json());

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.companyName !== undefined) data.companyName = body.companyName;
    if (body.phone !== undefined) data.phone = body.phone;
    if (body.ampAuthorized !== undefined) data.ampAuthorized = body.ampAuthorized;
    if (body.minProjectCost !== undefined) data.minProjectCost = body.minProjectCost;
    if (body.maxProjectCost !== undefined) data.maxProjectCost = body.maxProjectCost;
    if (body.alertSmsEnabled !== undefined) data.alertSmsEnabled = body.alertSmsEnabled;
    if (body.onboardingComplete !== undefined) data.onboardingComplete = body.onboardingComplete;
    if (body.trades !== undefined) data.trades = JSON.stringify(body.trades);
    if (body.regions !== undefined) data.regions = JSON.stringify(body.regions);
    if (body.rbqLicenseClass !== undefined) data.rbqLicenseClass = body.rbqLicenseClass;
    if (body.rbqLicenseNumber !== undefined) data.rbqLicenseNumber = body.rbqLicenseNumber;

    // Government Readiness Passport fields.
    if (body.neq !== undefined) data.neq = body.neq;
    if (body.revenuQuebecStatus !== undefined) data.revenuQuebecStatus = body.revenuQuebecStatus;
    if (body.revenuQuebecExpiresAt !== undefined) {
      data.revenuQuebecExpiresAt = body.revenuQuebecExpiresAt
        ? new Date(body.revenuQuebecExpiresAt)
        : null;
    }
    if (body.cnesstStatus !== undefined) data.cnesstStatus = body.cnesstStatus;
    if (body.oqlfStatus !== undefined) data.oqlfStatus = body.oqlfStatus;
    if (body.insuranceCarrier !== undefined) data.insuranceCarrier = body.insuranceCarrier;
    if (body.insuranceExpiresAt !== undefined) {
      data.insuranceExpiresAt = body.insuranceExpiresAt
        ? new Date(body.insuranceExpiresAt)
        : null;
    }
    if (body.insuranceLimit !== undefined) data.insuranceLimit = body.insuranceLimit;
    if (body.bidBondCapacity !== undefined) data.bidBondCapacity = body.bidBondCapacity;
    if (body.lobbyismDeclarationOnFile !== undefined) {
      data.lobbyismDeclarationOnFile = body.lobbyismDeclarationOnFile;
    }
    if (body.signingResolutionOnFile !== undefined) {
      data.signingResolutionOnFile = body.signingResolutionOnFile;
    }
    if (body.referencesCount !== undefined) data.referencesCount = body.referencesCount;
    if (body.employeesCount !== undefined) data.employeesCount = body.employeesCount;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
    });

    if (body.rbqLicenseNumber) {
      await verifyAndUpdateUserRbq(
        user.id,
        body.rbqLicenseNumber,
        body.rbqLicenseClass ?? user.rbqLicenseClass
      );
    }

    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
        rbqLicenseClass: true,
        rbqLicenseNumber: true,
        rbqVerified: true,
        rbqVerifiedAt: true,
        trades: true,
        regions: true,
        phone: true,
        ampAuthorized: true,
        minProjectCost: true,
        maxProjectCost: true,
        alertSmsEnabled: true,
        onboardingComplete: true,
        plan: true,
        stripeCustomerId: true,
        neq: true,
        revenuQuebecStatus: true,
        revenuQuebecExpiresAt: true,
        cnesstStatus: true,
        oqlfStatus: true,
        insuranceCarrier: true,
        insuranceExpiresAt: true,
        insuranceLimit: true,
        bidBondCapacity: true,
        lobbyismDeclarationOnFile: true,
        signingResolutionOnFile: true,
        referencesCount: true,
        employeesCount: true,
      },
    });

    return NextResponse.json({ user: fresh ? toPublicUser(fresh) : toPublicUser(updated) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
