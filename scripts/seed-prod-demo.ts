/**
 * Upsert the demo login on production Postgres without wiping data.
 *
 * Usage: npm run seed:prod-demo
 * Requires DATABASE_URL / POSTGRES_PRISMA_URL via loadProdEnv().
 */
import bcrypt from "bcryptjs";
import { loadProdEnv } from "./load-prod-env";

loadProdEnv();

const DEMO_EMAIL = "demo@zonning.ca";
const DEMO_PASSWORD = "demo1234";

async function main() {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;

  if (base && secret) {
    const res = await fetch(`${base}/api/admin/seed-demo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = (await res.json()) as { ok?: boolean; email?: string; userId?: string };
    if (res.ok && json.ok) {
      console.log(`Demo user ready via production API: ${json.email} (id=${json.userId})`);
      console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
      return;
    }
    console.warn("Production API seed failed — falling back to direct DB upsert");
  }

  const { prisma } = await import("../src/lib/prisma");
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

  console.log(`Demo user ready: ${user.email} (id=${user.id})`);
  console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log("Ensure ADMIN_EMAILS includes demo@zonning.ca for /dashboard access.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
