import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isSyncAuthorized } from "@/lib/sync/auth";

const DEMO_EMAIL = "demo@zonning.ca";
const DEMO_PASSWORD = "demo1234";

/**
 * POST /api/admin/seed-demo
 * Upsert demo login on the same DB pool as production auth (CRON_SECRET).
 */
export async function POST(req: NextRequest) {
  if (!isSyncAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Jean Dupont",
      companyName: "Dupont Électrique Inc.",
      rbqLicenseClass: "4.1",
      rbqLicenseNumber: "1234-5678-01",
      rbqVerified: true,
      rbqVerifiedAt: new Date(),
      ampAuthorized: true,
      trades: JSON.stringify(["électrique", "commercial"]),
      regions: JSON.stringify(["Montréal", "Laval"]),
      minProjectCost: 50_000,
      maxProjectCost: 3_000_000,
      phone: "514-555-0123",
      plan: "PRO",
      onboardingComplete: true,
    },
    update: {
      passwordHash,
      onboardingComplete: true,
      plan: "PRO",
      ampAuthorized: true,
      rbqVerified: true,
    },
  });

  const match = await bcrypt.compare(DEMO_PASSWORD, user.passwordHash);

  return NextResponse.json({
    ok: true,
    email: user.email,
    userId: user.id,
    passwordVerified: match,
  });
}
