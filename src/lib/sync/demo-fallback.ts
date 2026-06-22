/**
 * Demo-data fallback guard.
 *
 * A freshly-deployed production database has zero rows until the first live
 * sync completes (and if every external fetch fails, it can stay empty). That
 * renders the public pages blank — the exact "nothing works" first impression
 * we must avoid. This guard detects an empty database and populates it with the
 * same deterministic demo dataset used in development, clearly flagged as demo
 * so the UI can show a banner. Live sync overwrites it via upsert on real
 * externalIds; the demo marker is cleared once real data lands.
 *
 * Idempotent and safe to call repeatedly: it only writes when the database is
 * empty, and uses createMany(skipDuplicates) so a partial previous run can't
 * conflict.
 */
import { prisma } from "@/lib/prisma";
import {
  generatePermits,
  generateTenders,
  generateAwards,
  generateAmendments,
  generateCompanies,
  generateSuppliers,
  generateRbqLicenses,
} from "../../../prisma/seed-data/generators";
import { generateIntelligence } from "../../../prisma/seed-data/intelligence";

const MARKER = "demo-fallback";

export type DataMode = "live" | "demo" | "empty";

export function isDemoFallbackEnabled(): boolean {
  // Opt-out via DEMO_FALLBACK=false (e.g. once real sync is trusted).
  return process.env.DEMO_FALLBACK !== "false";
}

export async function isDemoFallbackActive(): Promise<boolean> {
  const marker = await prisma.syncLog.findFirst({ where: { source: MARKER } });
  return Boolean(marker);
}

export async function getDataModeStatus(): Promise<{
  mode: DataMode;
  permitCount: number;
  tenderCount: number;
  demoFallbackActive: boolean;
}> {
  const [permitCount, tenderCount, demoFallbackActive] = await Promise.all([
    prisma.permit.count(),
    prisma.tender.count(),
    isDemoFallbackActive(),
  ]);
  const hasData = permitCount > 0 || tenderCount > 0;
  const mode: DataMode = !hasData ? "empty" : demoFallbackActive ? "demo" : "live";
  return { mode, permitCount, tenderCount, demoFallbackActive };
}

/**
 * Seed demo content if (and only if) the database has no permits. Returns
 * whether anything was inserted plus a machine-readable reason.
 */
export async function ensureDemoFallback(): Promise<{
  inserted: boolean;
  reason: "disabled" | "data-present" | "seeded";
  records?: number;
}> {
  if (!isDemoFallbackEnabled()) return { inserted: false, reason: "disabled" };

  const existing = await prisma.permit.count();
  if (existing > 0) return { inserted: false, reason: "data-present" };

  const intel = generateIntelligence();
  const permits = [...generatePermits(), ...intel.permits];

  // No skipDuplicates: SQLite doesn't support it, and the empty-DB guard above
  // means there's nothing to collide with.
  await prisma.permit.createMany({ data: permits as never });
  await prisma.tender.createMany({ data: generateTenders() as never });
  await prisma.tenderAward.createMany({ data: generateAwards() as never });
  await prisma.seaoAmendment.createMany({ data: generateAmendments() as never });
  await prisma.company.createMany({ data: generateCompanies() as never });
  await prisma.municipalSupplier.createMany({ data: generateSuppliers() as never });
  await prisma.rbqLicense.createMany({ data: generateRbqLicenses() as never });

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

  await prisma.syncLog.create({
    data: { source: MARKER, status: "success", recordsProcessed: permits.length },
  });

  return { inserted: true, reason: "seeded", records: permits.length };
}

/**
 * Once real sync has written live records, drop the demo marker so the UI stops
 * showing the demo banner. Call this after a successful live ingest.
 */
export async function clearDemoFallbackMarker(): Promise<void> {
  await prisma.syncLog.deleteMany({ where: { source: MARKER } });
}
