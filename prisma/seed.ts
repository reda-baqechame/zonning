import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { ALL_DATASET_IDS, DATASETS } from "../src/lib/datasets/registry";
import { Rng, hashSeed } from "./seed-data/rng";
import {
  generatePermits,
  generateTenders,
  generateAwards,
  generateAmendments,
  generateRbqLicenses,
  generateRbqInfractions,
  generateAmpAuthorizations,
  generateCompanies,
  generateSuppliers,
} from "./seed-data/generators";
import { generateIntelligence } from "./seed-data/intelligence";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "demo1234";

/** Monday 00:00 of the current week (UTC) — for usage counters. */
function weekStart(): Date {
  const d = new Date();
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function wipe() {
  // Children → parents to respect FK constraints.
  await prisma.webhookDelivery.deleteMany();
  await prisma.orgWebhook.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.savedLead.deleteMany();
  await prisma.publicContractPayment.deleteMany();
  await prisma.complianceRecord.deleteMany();
  await prisma.alertSubscription.deleteMany();
  await prisma.validationInterview.deleteMany();
  await prisma.conciergeRequest.deleteMany();
  await prisma.usageCounter.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.orgMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.digestSubscriber.deleteMany();
  await prisma.user.deleteMany();

  await prisma.datasetQualityCheck.deleteMany();
  await prisma.syncState.deleteMany();
  await prisma.syncLog.deleteMany();

  await prisma.permit.deleteMany();
  await prisma.tender.deleteMany();
  await prisma.tenderAward.deleteMany();
  await prisma.seaoAmendment.deleteMany();
  await prisma.company.deleteMany();
  await prisma.municipalSupplier.deleteMany();
  await prisma.rbqLicense.deleteMany();
  await prisma.rbqInfraction.deleteMany();
  await prisma.ampAuthorization.deleteMany();
  await prisma.propertyUnit.deleteMany();
  await prisma.propertyTransaction.deleteMany();
  await prisma.propertyTax.deleteMany();
  await prisma.commercialVacancy.deleteMany();
  await prisma.contaminatedSite.deleteMany();
  await prisma.zoningPoint.deleteMany();
  await prisma.zoningPolygon.deleteMany();
  await prisma.boroughZoning.deleteMany();
  await prisma.heritageSite.deleteMany();
  await prisma.developmentProject.deleteMany();
  await prisma.roadWork.deleteMany();
  await prisma.municipalContract.deleteMany();
  await prisma.boroughPermitDelay.deleteMany();
  await prisma.boroughPermitStat.deleteMany();
  await prisma.municipalInspection.deleteMany();
  await prisma.verdictReport.deleteMany();
}

async function seedUsers(passwordHash: string) {
  const base = {
    passwordHash,
    onboardingComplete: true,
    trades: JSON.stringify(["électrique", "commercial"]),
    regions: JSON.stringify(["Montréal", "Laval"]),
    minProjectCost: 50_000,
    maxProjectCost: 3_000_000,
  };

  const demo = await prisma.user.create({
    data: {
      ...base,
      email: "demo@zonning.ca",
      name: "Jean Dupont",
      companyName: "Dupont Électrique Inc.",
      rbqLicenseClass: "4.1",
      rbqLicenseNumber: "1234-5678-01",
      rbqVerified: true,
      rbqVerifiedAt: new Date(),
      ampAuthorized: true,
      phone: "514-555-0123",
      phoneVerified: true,
      alertSmsEnabled: true,
      plan: "PRO",
    },
  });

  await prisma.user.create({
    data: { ...base, email: "free@zonning.ca", name: "Marie Free", companyName: "Atelier Marie", plan: "FREE", rbqLicenseClass: "1.1.1" },
  });
  await prisma.user.create({
    data: { ...base, email: "essentiel@zonning.ca", name: "Luc Essentiel", companyName: "Toitures Cardinal Ltée", plan: "ESSENTIEL", rbqLicenseClass: "7", rbqLicenseNumber: "5004-1444-01", rbqVerified: true, rbqVerifiedAt: new Date() },
  });
  await prisma.user.create({
    data: { ...base, email: "pro@zonning.ca", name: "Sophie Pro", companyName: "Électro-Sud Montréal", plan: "PRO", rbqLicenseClass: "4.1", rbqLicenseNumber: "5008-1222-01", rbqVerified: true, rbqVerifiedAt: new Date(), ampAuthorized: true },
  });
  const equipe = await prisma.user.create({
    data: { ...base, email: "equipe@zonning.ca", name: "Pierre Équipe", companyName: "Groupe Mécanique Saint-Laurent", plan: "EQUIPE", rbqLicenseClass: "1.3", rbqLicenseNumber: "5001-1111-01", rbqVerified: true, rbqVerifiedAt: new Date(), ampAuthorized: true },
  });
  await prisma.user.create({
    data: { ...base, email: "admin@zonning.ca", name: "Admin ZONNING", companyName: "ZONNING", plan: "PRO" },
  });

  return { demo, equipe };
}

async function main() {
  console.log("Seeding ZONNING demo dataset (deterministic)…");
  await wipe();

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // --- Users + org -----------------------------------------------------------
  const { demo, equipe } = await seedUsers(passwordHash);

  const org = await prisma.organization.create({
    data: { name: "Groupe Mécanique Saint-Laurent", plan: "EQUIPE", ownerId: equipe.id },
  });
  await prisma.orgMember.createMany({
    data: [
      { orgId: org.id, userId: equipe.id, role: "owner" },
      { orgId: org.id, userId: demo.id, role: "member" },
    ],
  });

  // --- Core datasets ---------------------------------------------------------
  const intel = generateIntelligence();
  const permits = [...generatePermits(), ...intel.permits];
  const tenders = generateTenders();
  const awards = generateAwards();
  const amendments = generateAmendments();
  const rbqLicenses = generateRbqLicenses();
  const infractions = generateRbqInfractions(rbqLicenses);
  const ampAuths = generateAmpAuthorizations(rbqLicenses);
  const companies = generateCompanies();
  const suppliers = generateSuppliers();

  await prisma.permit.createMany({ data: permits as never });
  await prisma.tender.createMany({ data: tenders as never });
  await prisma.tenderAward.createMany({ data: awards as never });
  await prisma.seaoAmendment.createMany({ data: amendments as never });
  await prisma.rbqLicense.createMany({ data: rbqLicenses as never });
  await prisma.rbqInfraction.createMany({ data: infractions as never });
  await prisma.ampAuthorization.createMany({ data: ampAuths as never });
  await prisma.company.createMany({ data: companies as never });
  await prisma.municipalSupplier.createMany({ data: suppliers as never });

  // --- Intelligence layers ---------------------------------------------------
  await prisma.propertyUnit.createMany({ data: intel.propertyUnits as never });
  await prisma.propertyTransaction.createMany({ data: intel.transactions as never });
  await prisma.propertyTax.createMany({ data: intel.taxes as never });
  await prisma.commercialVacancy.createMany({ data: intel.vacancies as never });
  await prisma.contaminatedSite.createMany({ data: intel.contamination as never });
  await prisma.zoningPoint.createMany({ data: intel.zoningPoints as never });
  await prisma.zoningPolygon.createMany({ data: intel.zoningPolygons as never });
  await prisma.boroughZoning.createMany({ data: intel.boroughZoning as never });
  await prisma.heritageSite.createMany({ data: intel.heritage as never });
  await prisma.developmentProject.createMany({ data: intel.devProjects as never });
  await prisma.roadWork.createMany({ data: intel.roadworks as never });
  await prisma.municipalContract.createMany({ data: intel.contracts as never });
  await prisma.boroughPermitDelay.createMany({ data: intel.delays as never });
  await prisma.boroughPermitStat.createMany({ data: intel.stats as never });
  await prisma.municipalInspection.createMany({ data: intel.inspections as never });

  // --- Engagement ------------------------------------------------------------
  await prisma.alertSubscription.createMany({
    data: [
      { userId: demo.id, module: "permits", filters: JSON.stringify({ city: "Montréal", minCost: 100000 }), emailEnabled: true, smsEnabled: true },
      { userId: demo.id, module: "tenders", filters: JSON.stringify({ category: "Travaux de construction" }), emailEnabled: true },
      { userId: equipe.id, module: "permits", filters: JSON.stringify({ city: "Laval" }), emailEnabled: true },
    ],
  });

  await prisma.complianceRecord.createMany({
    data: Array.from({ length: 6 }, (_, i) => ({
      userId: demo.id,
      contactName: `Contact Public ${i + 1}`,
      contactEmail: `contact${i}@example.ca`,
      sourceType: "permit",
      sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/vmtl-permis-construction",
      sourceFetchedAt: new Date(Date.now() - i * 86_400_000),
      lawfulBasis: "conspicuous_publication",
      certificateIssuedAt: new Date(Date.now() - i * 86_400_000),
    })),
  });

  await prisma.conciergeRequest.create({
    data: {
      userId: demo.id,
      status: "completed",
      opportunities: JSON.stringify(["seed-tender-1", "seed-tender-3", "seed-permit-Montréal-2"]),
      notes: "Curated 3 high-fit opportunities for the week.",
      completedAt: new Date(),
    },
  });

  await prisma.digestSubscriber.createMany({
    data: Array.from({ length: 8 }, (_, i) => ({
      email: `digest${i}@example.ca`,
      borough: i % 2 ? "Le Plateau-Mont-Royal" : "Ville-Marie",
      trade: i % 2 ? "électrique" : "plomberie",
      locale: i % 3 === 0 ? "en" : "fr",
      active: true,
    })),
  });

  await prisma.publicContractPayment.createMany({
    data: Array.from({ length: 5 }, (_, i) => ({
      userId: equipe.id,
      title: `Contrat public ${i + 1} — Ville de Montréal`,
      awardDate: new Date(Date.now() - (i + 2) * 30 * 86_400_000),
      invoiceDate: new Date(Date.now() - (i + 1) * 20 * 86_400_000),
      paymentDue: new Date(Date.now() + (i + 1) * 15 * 86_400_000),
      amount: (i + 1) * 85_000,
      tenderAwardId: `seed-award-${i}`,
      notes: i === 0 ? "Retenue de garantie 10 %." : null,
    })),
  });

  await prisma.validationInterview.createMany({
    data: [
      { interviewerName: "Reda B.", companyName: "Boréal Construction", role: "Estimateur", q1Pipeline: "Bouche-à-oreille + SEAO", q2RbqPain: "Vérification manuelle", q3SeaoHours: "6h/semaine", q4WouldPay: "Oui", wouldPayAmount: 149, urgencyScore: 8 },
      { interviewerName: "Reda B.", companyName: "Électro-Sud", role: "Propriétaire", q1Pipeline: "Références", q2RbqPain: "Sous-classes confuses", q3SeaoHours: "4h/semaine", q4WouldPay: "Oui", wouldPayAmount: 99, urgencyScore: 7 },
    ],
  });

  await prisma.savedLead.createMany({
    data: [
      { userId: demo.id, kind: "permit", itemId: "seed-permit-Montréal-0", notes: "Bon fit RBQ 4.1" },
      { userId: demo.id, kind: "tender", itemId: "seed-tender-2", notes: "Clôture bientôt" },
      { userId: demo.id, kind: "tender", itemId: "seed-tender-5" },
    ],
  });

  const ws = weekStart();
  await prisma.usageCounter.createMany({
    data: [
      { userId: demo.id, key: "verdict", count: 12, weekStart: ws },
      { userId: demo.id, key: "export", count: 3, weekStart: ws },
      { userId: equipe.id, key: "api", count: 240, weekStart: ws },
    ],
  });

  // --- Sync health (green dashboard) -----------------------------------------
  const now = new Date();
  const rng = new Rng(hashSeed("sync"));
  for (const id of ALL_DATASET_IDS) {
    const records = rng.int(120, 14_500);
    await prisma.syncState.create({
      data: {
        datasetId: id,
        lastSuccessAt: now,
        lastRunAt: now,
        recordsProcessed: records,
        status: "success",
        sourceModifiedAt: new Date(now.getTime() - rng.int(1, 48) * 3_600_000),
        qualityChecks: {
          create: {
            rowsIngested: records,
            rowsInDb: records,
            durationMs: rng.int(200, 9000),
            status: "ok",
            message: "Demo seed — ingestion nominale.",
            sourceModifiedAt: new Date(now.getTime() - rng.int(1, 48) * 3_600_000),
          },
        },
      },
    });
  }

  await prisma.syncLog.createMany({
    data: ALL_DATASET_IDS.slice(0, 24).map((id) => ({
      source: DATASETS[id].syncSource ?? id,
      status: "success",
      recordsProcessed: rng.int(120, 14_500),
      ranAt: new Date(now.getTime() - rng.int(1, 72) * 3_600_000),
    })),
  });

  const counts = {
    permits: permits.length,
    tenders: tenders.length,
    awards: awards.length,
    companies: companies.length,
    zoningPoints: intel.zoningPoints.length,
    syncStates: ALL_DATASET_IDS.length,
  };
  console.log("Seed complete:", counts);
  console.log("Logins (password: demo1234): demo@ / free@ / essentiel@ / pro@ / equipe@ / admin@ zonning.ca");
  console.log("Showcase addresses live at /verdict — e.g. '1500 rue Wellington', '4200 boulevard Saint-Laurent'.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
