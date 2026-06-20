import { prisma } from "@/lib/prisma";
import { getRequiredRbqClasses } from "@/lib/rbq";
import {
  DATASETS,
  getSyncLimit,
  isDatasetSyncEnabled,
  type DatasetId,
} from "@/lib/datasets/registry";
import { fetchPermitsPaginated } from "@/lib/datasets/fetchers/permits";
import { fetchTenders } from "@/lib/datasets/fetchers/tenders";
import { fetchSuppliers } from "@/lib/datasets/fetchers/suppliers";
import { fetchTransactions } from "@/lib/datasets/fetchers/transactions";
import { fetchAssessments } from "@/lib/datasets/fetchers/assessment";
import { fetchContamination } from "@/lib/datasets/fetchers/contamination";
import { fetchCommercialVacancies } from "@/lib/datasets/fetchers/commercial";
import { fetchPropertyTaxes } from "@/lib/datasets/fetchers/taxes";
import { fetchRegistre } from "@/lib/datasets/fetchers/registre";
import { fetchAwards } from "@/lib/datasets/fetchers/awards";
import { fetchZoningByBorough } from "@/lib/datasets/fetchers/zoning";
import { fetchRbqLicensesPage } from "@/lib/datasets/fetchers/rbq";
import { fetchCityPermitsPaginated, fetchLevisPermits } from "@/lib/datasets/fetchers/city-permits";
import { fetchHeritageSitesPage } from "@/lib/datasets/fetchers/heritage";
import { fetchPermitStats } from "@/lib/datasets/fetchers/permit-stats";
import { fetchPum2050Zoning } from "@/lib/datasets/fetchers/pum2050-zoning";
import { fetchContaminationGtc } from "@/lib/datasets/fetchers/contamination-gtc";
import {
  fetchHeritageLpc,
  fetchPum2050Heritage,
} from "@/lib/datasets/fetchers/heritage-geo";
import { fetchPermitDelays } from "@/lib/datasets/fetchers/permit-delays";
import {
  fetchSherbrookeProjects,
  fetchBrossardProjects,
} from "@/lib/datasets/fetchers/development-projects";
import { fetchZoningTroisRivieres } from "@/lib/datasets/fetchers/zoning-regional";
import { fetchRoadworksSaguenay } from "@/lib/datasets/fetchers/roadworks-saguenay";
import { fetchRoadWorks } from "@/lib/datasets/fetchers/roadworks";
import {
  fetchMunicipalContracts,
  fetchMunicipalContractsForDataset,
} from "@/lib/datasets/fetchers/contracts";
import { normalizeLicenseNumber } from "@/lib/datasets/fetchers/rbq";
import { transactionChunkUpsert } from "@/lib/sync/batch-upsert";
import { checkSourceChanged, getSourceChangeInfo } from "@/lib/datasets/change-detection";
import { summarizeNewTenders } from "@/lib/ai/tender-summary";
import {
  fetchSeaoAmendments,
  fetchCompletedContracts,
} from "@/lib/datasets/fetchers/seao-extensions";

const WEEKLY_DATASET_IDS: DatasetId[] = [
  "assessment",
  "taxes",
  "transactions",
  "transactions-2023",
  "transactions-2025",
  "zoning",
  "pum2050-zoning",
  "permit-stats",
  "permit-delays",
  "projects-sherbrooke",
  "projects-brossard",
  "zoning-trois-rivieres",
  "roadworks-saguenay",
  "toronto-permits",
];

const RBQ_BATCH = 3000;
const HERITAGE_BATCH = 500;

async function trySkipUnchangedWeekly(datasetId: DatasetId): Promise<SyncResult | null> {
  if (!WEEKLY_DATASET_IDS.includes(datasetId)) return null;

  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  if (!state?.sourceModifiedAt || !state.lastSuccessAt) return null;

  const { changed } = await checkSourceChanged(datasetId, state.sourceModifiedAt);
  if (changed) return null;

  await prisma.syncState.update({
    where: { datasetId },
    data: { lastRunAt: new Date(), lastSuccessAt: new Date(), status: "idle" },
  });

  return {
    dataset: datasetId,
    ok: true,
    processed: 0,
    source: "skipped",
  };
}

async function persistSourceMetadata(datasetId: DatasetId) {
  const info = await getSourceChangeInfo(datasetId);
  const cfg = DATASETS[datasetId];
  const sourceModifiedAt =
    info.sourceModifiedAt ??
    (cfg.arcGisLayerUrl || cfg.directResourceUrl ? new Date() : null);
  if (!sourceModifiedAt) return;
  await prisma.syncState.upsert({
    where: { datasetId },
    create: {
      datasetId,
      sourceModifiedAt,
      status: "idle",
    },
    update: { sourceModifiedAt },
  });
}

async function prepareResumableOffset(datasetId: DatasetId) {
  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  const change = await checkSourceChanged(datasetId, state?.sourceModifiedAt);
  let offset = state?.syncOffset ?? 0;

  if (change.changed) {
    offset = 0;
    await prisma.syncState.upsert({
      where: { datasetId },
      create: {
        datasetId,
        syncOffset: 0,
        sourceModifiedAt: change.sourceModifiedAt ?? undefined,
        status: "idle",
      },
      update: {
        syncOffset: 0,
        sourceModifiedAt: change.sourceModifiedAt ?? undefined,
      },
    });
  }

  return { offset, sourceModifiedAt: change.sourceModifiedAt };
}

async function finalizeResumableOffset(
  datasetId: DatasetId,
  offset: number,
  fetched: number,
  complete: boolean,
  processed: number
) {
  await prisma.syncState.update({
    where: { datasetId },
    data: {
      syncOffset: complete ? 0 : offset + fetched,
      recordsProcessed: processed,
      ...(complete ? { lastSuccessAt: new Date() } : {}),
    },
  });
}

export type SyncResult = {
  dataset: DatasetId;
  ok: boolean;
  processed: number;
  source: "live" | "unchanged" | "empty" | "skipped" | "error";
  error?: string;
};

const running = new Set<DatasetId>();

async function logSync(
  source: string,
  status: string,
  recordsProcessed: number,
  error?: string
) {
  await prisma.syncLog.create({
    data: { source, status, recordsProcessed, error: error ?? null },
  });
}

async function acquireLock(datasetId: DatasetId): Promise<boolean> {
  if (running.has(datasetId)) return false;

  const staleCutoff = new Date(Date.now() - 30 * 60 * 1000);

  await prisma.syncState.upsert({
    where: { datasetId },
    create: { datasetId, status: "idle", lastRunAt: new Date(0) },
    update: {},
  });

  const acquired = await prisma.syncState.updateMany({
    where: {
      datasetId,
      OR: [{ status: { not: "running" } }, { lastRunAt: { lt: staleCutoff } }],
    },
    data: { status: "running", lastRunAt: new Date() },
  });

  if (acquired.count === 0) return false;

  running.add(datasetId);
  return true;
}

async function releaseLock(
  datasetId: DatasetId,
  result: { ok: boolean; processed: number; source: SyncResult["source"]; error?: string },
) {
  running.delete(datasetId);
  const freshnessConfirmed = result.ok && !["empty", "skipped"].includes(result.source);
  await prisma.syncState.upsert({
    where: { datasetId },
    create: {
      datasetId,
      status: result.ok ? "idle" : "error",
      lastRunAt: new Date(),
      lastSuccessAt: freshnessConfirmed ? new Date() : undefined,
      recordsProcessed: result.processed,
      lastError: result.error ?? null,
    },
    update: {
      status: result.ok ? "idle" : "error",
      lastRunAt: new Date(),
      ...(freshnessConfirmed ? { lastSuccessAt: new Date() } : {}),
      recordsProcessed: result.processed,
      lastError: result.error ?? null,
    },
  });
}

async function runSync(
  datasetId: DatasetId,
  fn: () => Promise<SyncResult>
): Promise<SyncResult> {
  if (process.env.SYNC_ENABLED === "false") {
    return { dataset: datasetId, ok: true, processed: 0, source: "skipped" };
  }

  const { isCircuitOpen } = await import("./circuit-breaker");
  if (await isCircuitOpen(datasetId)) {
    return {
      dataset: datasetId,
      ok: true,
      processed: 0,
      source: "skipped",
      error: "Circuit open — cooling down after repeated failures",
    };
  }

  const locked = await acquireLock(datasetId);
  if (!locked) {
    return {
      dataset: datasetId,
      ok: true,
      processed: 0,
      source: "skipped",
      error: "Sync already running",
    };
  }

  const started = Date.now();
  try {
    const result = await fn();
    await releaseLock(datasetId, result);
    try {
      const { recordQualityCheck } = await import("./quality");
      await recordQualityCheck(datasetId, result, Date.now() - started);
    } catch {
      /* quality optional */
    }
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    if (process.env.SENTRY_DSN) {
      try {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureException(e, { tags: { datasetId } });
      } catch {
        /* optional */
      }
    }
    const result: SyncResult = {
      dataset: datasetId,
      ok: false,
      processed: 0,
      source: "error",
      error: message,
    };
    await releaseLock(datasetId, result);
    try {
      const { recordQualityCheck } = await import("./quality");
      await recordQualityCheck(datasetId, result, Date.now() - started);
    } catch {
      /* quality optional */
    }
    return result;
  }
}

async function upsertPermitRecords(
  remote: Awaited<ReturnType<typeof fetchPermitsPaginated>>,
  city = "Montréal"
) {
  const chunkSize = 25;

  const { processed, results } = await transactionChunkUpsert(remote, chunkSize, (p) => {
    const required = getRequiredRbqClasses(p.permitType, p.workType);
    return prisma.permit.upsert({
      where: { externalId: p.externalId },
      create: {
        ...p,
        city: p.city ?? city,
        requiredRbqClasses: JSON.stringify(required),
      },
      update: {
        ...p,
        city: p.city ?? city,
        requiredRbqClasses: JSON.stringify(required),
        sourceFetchedAt: new Date(),
      },
    });
  });

  const newIds = results.map((r) => r.id);

  if (newIds.length > 0) {
    try {
      const { dispatchPermitCreatedEvents, dispatchHighScoreLeadEvents } = await import(
        "@/lib/webhooks/dispatcher"
      );
      await Promise.all([
        dispatchPermitCreatedEvents(newIds.slice(0, 50)),
        dispatchHighScoreLeadEvents(newIds.slice(0, 50)),
      ]);
      try {
        const { schedulePermitIngestAlerts } = await import("@/lib/alerts/permit-ingest");
        schedulePermitIngestAlerts(newIds);
      } catch {
        /* alerts optional */
      }
    } catch {
      /* webhooks optional */
    }
  }

  try {
    const { scheduleGeocodeAfterPermitIngest } = await import("./geocode-on-ingest");
    scheduleGeocodeAfterPermitIngest(city);
  } catch {
    /* geocode optional */
  }

  return processed;
}

export async function syncPermits(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.permits;
  return runSync("permits", async () => {
    try {
      const state = await prisma.syncState.findUnique({ where: { datasetId: "permits" } });
      const minIssueDate = state?.cursor ? new Date(state.cursor) : undefined;
      const remote = await fetchPermitsPaginated(limit ?? getSyncLimit("permits"), {
        maxAgeDays: 365,
        minIssueDate,
      });
      const processed = await upsertPermitRecords(remote);

      const newest = remote.find((p) => p.issueDate);
      if (newest?.issueDate) {
        await prisma.syncState.update({
          where: { datasetId: "permits" },
          data: { cursor: newest.issueDate.toISOString() },
        });
      }

      await persistSourceMetadata("permits");

      try {
        const { summarizeNewPermits } = await import("@/lib/ai/permit-summary");
        await summarizeNewPermits(20);
      } catch {
        /* summaries optional */
      }

      const source = remote.length > 0 ? "live" : minIssueDate ? "unchanged" : "empty";
      const status = source === "live" ? "success" : source;
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "permits",
        ok: true,
        processed,
        source,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

async function syncCityPermitsDataset(
  datasetId: "permits-laval" | "permits-longueuil" | "permits-quebec" | "permits-gatineau"
): Promise<SyncResult> {
  const cfg = DATASETS[datasetId];
  return runSync(datasetId, async () => {
    try {
      const state = await prisma.syncState.findUnique({ where: { datasetId } });
      const minIssueDate = state?.cursor ? new Date(state.cursor) : undefined;
      const remote = await fetchCityPermitsPaginated(datasetId, undefined, {
        maxAgeDays: 365,
        minIssueDate,
      });
      const processed = await upsertPermitRecords(remote, cfg.city);

      const newest = remote.find((p) => p.issueDate);
      if (newest?.issueDate) {
        await prisma.syncState.update({
          where: { datasetId },
          data: { cursor: newest.issueDate.toISOString() },
        });
      }

      await persistSourceMetadata(datasetId);
      const source = remote.length > 0 ? "live" : minIssueDate ? "unchanged" : "empty";
      const status = source === "live" ? "success" : source;
      await logSync(cfg.syncSource, status, processed);

      try {
        const { summarizeNewPermits } = await import("@/lib/ai/permit-summary");
        await summarizeNewPermits(15);
      } catch {
        /* optional */
      }

      return {
        dataset: datasetId,
        ok: true,
        processed,
        source,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncPermitsLaval(): Promise<SyncResult> {
  return syncCityPermitsDataset("permits-laval");
}

export async function syncPermitsLongueuil(): Promise<SyncResult> {
  return syncCityPermitsDataset("permits-longueuil");
}

export async function syncPermitsQuebec(): Promise<SyncResult> {
  return syncCityPermitsDataset("permits-quebec");
}

export async function syncPermitsGatineau(): Promise<SyncResult> {
  return syncCityPermitsDataset("permits-gatineau");
}

export async function syncRbq(): Promise<SyncResult> {
  const cfg = DATASETS.rbq;
  return runSync("rbq", async () => {
    try {
      const { offset } = await prepareResumableOffset("rbq");
      const page = await fetchRbqLicensesPage(offset, RBQ_BATCH);

      const { processed } = await transactionChunkUpsert(page.records, 30, (r) => {
        const licenseNumber = normalizeLicenseNumber(r.licenseNumber);
        return prisma.rbqLicense.upsert({
          where: { licenseNumber },
          create: {
            licenseNumber,
            holderName: r.holderName,
            subclass: r.subclass,
            status: r.status,
            expiryDate: r.expiryDate,
            sourceUrl: r.sourceUrl,
          },
          update: {
            holderName: r.holderName,
            subclass: r.subclass,
            status: r.status,
            expiryDate: r.expiryDate,
            sourceFetchedAt: new Date(),
          },
        });
      });

      await finalizeResumableOffset("rbq", offset, page.fetched, page.complete, processed);
      if (page.complete) await persistSourceMetadata("rbq");

      const status = processed > 0 ? "success" : page.complete ? "empty" : "partial";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "rbq",
        ok: true,
        processed,
        source: processed > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncTenders(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.tenders;
  return runSync("tenders", async () => {
    try {
      const state = await prisma.syncState.findUnique({ where: { datasetId: "tenders" } });
      const { records: remote, latestBundle } = await fetchTenders(
        limit ?? getSyncLimit("tenders"),
        { sinceBundle: state?.cursor ?? null }
      );
      let processed = 0;
      const tenderIds: string[] = [];

      for (const t of remote) {
        const record = await prisma.tender.upsert({
          where: { externalId: t.externalId },
          create: {
            ...t,
            requiresAmp: t.requiresAmp ?? false,
          },
          update: { ...t, requiresAmp: t.requiresAmp ?? false },
        });
        tenderIds.push(record.id);
        processed++;
      }

      if (latestBundle) {
        await prisma.syncState.update({
          where: { datasetId: "tenders" },
          data: { cursor: latestBundle },
        });
      }

      void summarizeNewTenders(10);

      await prisma.tender.updateMany({
        where: { closesAt: { lt: new Date() }, status: { not: "closed" } },
        data: { status: "closed" },
      });

      await persistSourceMetadata("tenders");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);

      if (tenderIds.length > 0) {
        try {
          const { dispatchTenderCreatedEvents } = await import("@/lib/webhooks/dispatcher");
          await dispatchTenderCreatedEvents(tenderIds.slice(0, 20));
        } catch {
          /* webhooks optional */
        }
      }

      return {
        dataset: "tenders",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncSuppliers(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.suppliers;
  return runSync("suppliers", async () => {
    try {
      const remote = await fetchSuppliers(limit ?? getSyncLimit("suppliers"));
      let processed = 0;

      for (const s of remote) {
        await prisma.municipalSupplier.upsert({
          where: { externalId: s.externalId },
          create: { ...s, sourceFetchedAt: new Date() },
          update: { ...s, sourceFetchedAt: new Date() },
        });

        if (s.neq) {
          await prisma.company.upsert({
            where: { neq: s.neq },
            create: {
              name: s.name,
              neq: s.neq,
              city: "Montréal",
              region: s.borough ?? "Montréal",
              sector: "Fournisseur municipal",
              capabilities: JSON.stringify(["fournisseur", "municipal"]),
              sourceUrl: s.sourceUrl,
              phone: s.phone,
              isSupplier: true,
            },
            update: {
              name: s.name,
              phone: s.phone,
              region: s.borough ?? "Montréal",
              isSupplier: true,
              sourceUrl: s.sourceUrl,
            },
          });
        }
        processed++;
      }

      await persistSourceMetadata("suppliers");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "suppliers",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncTransactions(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.transactions;
  return runSync("transactions", async () => {
    try {
      const skipped = await trySkipUnchangedWeekly("transactions");
      if (skipped) return skipped;

      const remote = await fetchTransactions(limit ?? getSyncLimit("transactions"), "transactions");
      let processed = 0;

      for (const t of remote) {
        await prisma.propertyTransaction.upsert({
          where: { externalId: t.externalId },
          create: { ...t, sourceFetchedAt: new Date() },
          update: { ...t, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("transactions");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "transactions",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncTransactions2023(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS["transactions-2023"];
  return runSync("transactions-2023", async () => {
    try {
      const skipped = await trySkipUnchangedWeekly("transactions-2023");
      if (skipped) return skipped;

      const remote = await fetchTransactions(
        limit ?? getSyncLimit("transactions-2023"),
        "transactions-2023"
      );
      let processed = 0;

      for (const t of remote) {
        const externalId = `2023-${t.externalId}`;
        await prisma.propertyTransaction.upsert({
          where: { externalId },
          create: { ...t, externalId, sourceFetchedAt: new Date() },
          update: { ...t, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("transactions-2023");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "transactions-2023",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

async function syncHeritageDataset(
  datasetId: "heritage" | "heritage-eip"
): Promise<SyncResult> {
  const cfg = DATASETS[datasetId];
  return runSync(datasetId, async () => {
    try {
      const { offset } = await prepareResumableOffset(datasetId);
      const page = await fetchHeritageSitesPage(datasetId, offset, HERITAGE_BATCH);
      let processed = 0;

      for (const h of page.records) {
        await prisma.heritageSite.upsert({
          where: { externalId: h.externalId },
          create: { ...h, sourceFetchedAt: new Date() },
          update: { ...h, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await finalizeResumableOffset(
        datasetId,
        offset,
        page.fetched,
        page.complete,
        processed
      );
      if (page.complete) await persistSourceMetadata(datasetId);

      const status = processed > 0 ? "success" : page.complete ? "empty" : "partial";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: datasetId,
        ok: true,
        processed,
        source: processed > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncHeritage(): Promise<SyncResult> {
  return syncHeritageDataset("heritage");
}

export async function syncHeritageEip(): Promise<SyncResult> {
  return syncHeritageDataset("heritage-eip");
}

export async function syncContracts(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.contracts;
  return runSync("contracts", async () => {
    try {
      const remote = await fetchMunicipalContracts(limit ?? getSyncLimit("contracts"));
      let processed = 0;

      for (const c of remote) {
        await prisma.municipalContract.upsert({
          where: { externalId: c.externalId },
          create: { ...c, sourceFetchedAt: new Date() },
          update: { ...c, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("contracts");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "contracts",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncRoadworks(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.roadworks;
  return runSync("roadworks", async () => {
    try {
      const remote = await fetchRoadWorks(limit ?? getSyncLimit("roadworks"));
      let processed = 0;

      for (const r of remote) {
        await prisma.roadWork.upsert({
          where: { externalId: r.externalId },
          create: { ...r, city: "Montréal", sourceFetchedAt: new Date() },
          update: { ...r, city: "Montréal", sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("roadworks");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "roadworks",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncPermitStats(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS["permit-stats"];
  return runSync("permit-stats", async () => {
    try {
      const skipped = await trySkipUnchangedWeekly("permit-stats");
      if (skipped) return skipped;

      const remote = await fetchPermitStats(limit ?? getSyncLimit("permit-stats"));
      let processed = 0;

      for (const s of remote) {
        await prisma.boroughPermitStat.upsert({
          where: { externalId: s.externalId },
          create: { ...s, sourceFetchedAt: new Date() },
          update: { ...s, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("permit-stats");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "permit-stats",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncAssessments(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.assessment;
  return runSync("assessment", async () => {
    try {
      const skipped = await trySkipUnchangedWeekly("assessment");
      if (skipped) return skipped;

      const remote = await fetchAssessments(limit ?? getSyncLimit("assessment"));
      let processed = 0;

      for (const a of remote) {
        await prisma.propertyUnit.upsert({
          where: { matricule: a.matricule },
          create: { ...a, sourceFetchedAt: new Date() },
          update: { ...a, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("assessment");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "assessment",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncContamination(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.contamination;
  return runSync("contamination", async () => {
    try {
      const remote = await fetchContamination(limit ?? getSyncLimit("contamination"));
      let processed = 0;

      for (const c of remote) {
        await prisma.contaminatedSite.upsert({
          where: { externalId: c.externalId },
          create: { ...c, sourceLayer: "mtl", sourceFetchedAt: new Date() },
          update: { ...c, sourceLayer: "mtl", sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("contamination");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "contamination",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncCommercial(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.commercial;
  return runSync("commercial", async () => {
    try {
      const remote = await fetchCommercialVacancies(limit ?? getSyncLimit("commercial"));
      let processed = 0;

      for (const c of remote) {
        await prisma.commercialVacancy.upsert({
          where: { externalId: c.externalId },
          create: { ...c, sourceFetchedAt: new Date() },
          update: { ...c, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("commercial");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "commercial",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncTaxes(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.taxes;
  return runSync("taxes", async () => {
    try {
      const skipped = await trySkipUnchangedWeekly("taxes");
      if (skipped) return skipped;

      const remote = await fetchPropertyTaxes(limit ?? getSyncLimit("taxes"));
      let processed = 0;

      for (const t of remote) {
        await prisma.propertyTax.upsert({
          where: { externalId: t.externalId },
          create: { ...t, sourceFetchedAt: new Date() },
          update: { ...t, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("taxes");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "taxes",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncRegistre(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.registre;
  return runSync("registre", async () => {
    try {
      const remote = await fetchRegistre(limit ?? getSyncLimit("registre"));
      let processed = 0;

      for (const r of remote) {
        if (r.neq) {
          await prisma.company.upsert({
            where: { neq: r.neq },
            create: {
              name: r.name,
              neq: r.neq,
              city: r.city,
              region: r.region ?? "Québec",
              sector: r.sector,
              sourceUrl: r.sourceUrl,
              capabilities: JSON.stringify(["registre"]),
            },
            update: {
              name: r.name,
              city: r.city,
              region: r.region ?? "Québec",
              sector: r.sector,
              sourceUrl: r.sourceUrl,
            },
          });
        } else {
          const existing = await prisma.company.findFirst({
            where: { name: r.name, region: r.region ?? undefined },
          });
          if (existing) {
            await prisma.company.update({
              where: { id: existing.id },
              data: { sector: r.sector, sourceUrl: r.sourceUrl },
            });
          } else {
            await prisma.company.create({
              data: {
                name: r.name,
                city: r.city,
                region: r.region ?? "Québec",
                sector: r.sector,
                sourceUrl: r.sourceUrl,
                capabilities: JSON.stringify(["registre"]),
              },
            });
          }
        }
        processed++;
      }

      await persistSourceMetadata("registre");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "registre",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncAwards(limit?: number): Promise<SyncResult> {
  const cfg = DATASETS.awards;
  return runSync("awards", async () => {
    try {
      const remote = await fetchAwards(limit ?? getSyncLimit("awards"));
      let processed = 0;

      for (const a of remote) {
        await prisma.tenderAward.upsert({
          where: { externalId: a.externalId },
          create: { ...a, sourceFetchedAt: new Date() },
          update: { ...a, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      const amendments = await fetchSeaoAmendments(300);
      for (const am of amendments) {
        await prisma.seaoAmendment.upsert({
          where: { externalId: am.externalId },
          create: { ...am, sourceFetchedAt: new Date() },
          update: { ...am, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      const completed = await fetchCompletedContracts(200);
      for (const c of completed) {
        await prisma.tenderAward.upsert({
          where: { externalId: c.externalId },
          create: { ...c, sourceFetchedAt: new Date() },
          update: { ...c, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("awards");
      const status = remote.length > 0 ? "success" : "empty";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "awards",
        ok: true,
        processed,
        source: remote.length > 0 ? "live" : "empty",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

export async function syncZoning(): Promise<SyncResult> {
  const cfg = DATASETS.zoning;
  return runSync("zoning", async () => {
    try {
      const skipped = await trySkipUnchangedWeekly("zoning");
      if (skipped) return skipped;

      const remote = await fetchZoningByBorough();
      let processed = 0;

      for (const z of remote) {
        await prisma.boroughZoning.upsert({
          where: { borough: z.borough },
          create: { ...z, sourceFetchedAt: new Date() },
          update: { ...z, sourceFetchedAt: new Date() },
        });
        processed++;
      }

      await persistSourceMetadata("zoning");
      if (remote.length === 0) {
        await logSync(cfg.syncSource, "error", 0, "No zoning data from CKAN source");
        return {
          dataset: "zoning",
          ok: false,
          processed: 0,
          source: "error",
          error: "No zoning data from CKAN source",
        };
      }
      const status = "success";
      await logSync(cfg.syncSource, status, processed);
      return {
        dataset: "zoning",
        ok: true,
        processed,
        source: "live",
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Sync failed";
      await logSync(cfg.syncSource, "error", 0, message);
      throw e;
    }
  });
}

async function upsertZoningPointBatch(
  remote: Awaited<ReturnType<typeof fetchPum2050Zoning>>
) {
  if (remote.length > 0) {
    await prisma.zoningPoint.deleteMany({
      where: {
        city: { in: [...new Set(remote.map((record) => record.city))] },
        landUse: null,
        intensificationLevel: null,
        densityThreshold: null,
        zoneCode: null,
      },
    });
  }
  return transactionChunkUpsert(remote, 40, (z) =>
    prisma.zoningPoint.upsert({
      where: { externalId: z.externalId },
      create: { ...z, sourceFetchedAt: new Date() },
      update: { ...z, sourceFetchedAt: new Date() },
    })
  );
}

async function upsertHeritageGeoBatch(
  remote: Awaited<ReturnType<typeof fetchHeritageLpc>>
) {
  let processed = 0;
  for (const h of remote) {
    await prisma.heritageSite.upsert({
      where: { externalId: h.externalId },
      create: {
        externalId: h.externalId,
        name: h.name,
        address: h.address,
        borough: h.borough,
        latitude: h.latitude,
        longitude: h.longitude,
        category: h.category,
        status: h.status,
        description: h.description,
        sourceUrl: h.sourceUrl,
        sourceFetchedAt: new Date(),
      },
      update: {
        name: h.name,
        address: h.address,
        borough: h.borough,
        latitude: h.latitude,
        longitude: h.longitude,
        category: h.category,
        status: h.status,
        description: h.description,
        sourceFetchedAt: new Date(),
      },
    });
    processed++;
  }
  return processed;
}

export async function syncPum2050Zoning(): Promise<SyncResult> {
  const cfg = DATASETS["pum2050-zoning"];
  return runSync("pum2050-zoning", async () => {
    const invalidStoredCoordinates = await prisma.zoningPoint.count({
      where: {
        city: "Montréal",
        OR: [
          { latitude: { lt: 44 } },
          { latitude: { gt: 63 } },
          { longitude: { lt: -80 } },
          { longitude: { gt: -57 } },
        ],
      },
    });
    if (invalidStoredCoordinates === 0) {
      const skipped = await trySkipUnchangedWeekly("pum2050-zoning");
      if (skipped) return skipped;
    }
    const remote = await fetchPum2050Zoning();
    if (remote.length > 0) {
      await prisma.zoningPoint.deleteMany({
        where: { externalId: { startsWith: "pum2050-" } },
      });
    }
    const { processed } = await upsertZoningPointBatch(remote);
    await persistSourceMetadata("pum2050-zoning");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "pum2050-zoning",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncContaminationGtc(): Promise<SyncResult> {
  const cfg = DATASETS["contamination-gtc"];
  return runSync("contamination-gtc", async () => {
    const remote = await fetchContaminationGtc();
    const { processed } = await transactionChunkUpsert(remote, 40, (c) =>
      prisma.contaminatedSite.upsert({
        where: { externalId: c.externalId },
        create: {
          externalId: c.externalId,
          address: c.address,
          borough: c.borough,
          region: c.region,
          sourceLayer: "gtc",
          latitude: c.latitude,
          longitude: c.longitude,
          status: c.status,
          description: c.description,
          sourceUrl: c.sourceUrl,
          sourceFetchedAt: new Date(),
        },
        update: {
          address: c.address,
          borough: c.borough,
          region: c.region,
          sourceLayer: "gtc",
          latitude: c.latitude,
          longitude: c.longitude,
          status: c.status,
          description: c.description,
          sourceFetchedAt: new Date(),
        },
      })
    );
    await persistSourceMetadata("contamination-gtc");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "contamination-gtc",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncHeritageLpc(): Promise<SyncResult> {
  const cfg = DATASETS["heritage-lpc"];
  return runSync("heritage-lpc", async () => {
    const remote = await fetchHeritageLpc();
    const processed = await upsertHeritageGeoBatch(remote);
    await persistSourceMetadata("heritage-lpc");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "heritage-lpc",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncPum2050Heritage(): Promise<SyncResult> {
  const cfg = DATASETS["pum2050-heritage"];
  return runSync("pum2050-heritage", async () => {
    const remote = await fetchPum2050Heritage();
    const processed = await upsertHeritageGeoBatch(remote);
    await persistSourceMetadata("pum2050-heritage");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "pum2050-heritage",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncPermitDelays(): Promise<SyncResult> {
  const cfg = DATASETS["permit-delays"];
  return runSync("permit-delays", async () => {
    const remote = await fetchPermitDelays();
    let processed = 0;
    for (const d of remote) {
      await prisma.boroughPermitDelay.upsert({
        where: { externalId: d.externalId },
        create: { ...d, sourceFetchedAt: new Date() },
        update: { ...d, sourceFetchedAt: new Date() },
      });
      processed++;
    }
    await persistSourceMetadata("permit-delays");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "permit-delays",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncTransactions2025(): Promise<SyncResult> {
  const cfg = DATASETS["transactions-2025"];
  return runSync("transactions-2025", async () => {
    const skipped = await trySkipUnchangedWeekly("transactions-2025");
    if (skipped) return skipped;
    const remote = await fetchTransactions(undefined, "transactions-2025");
    let processed = 0;
    for (const t of remote) {
      await prisma.propertyTransaction.upsert({
        where: { externalId: t.externalId },
        create: { ...t, sourceFetchedAt: new Date() },
        update: { ...t, sourceFetchedAt: new Date() },
      });
      processed++;
    }
    await persistSourceMetadata("transactions-2025");
    const status = remote.length > 0 ? "success" : "empty";
    await logSync(cfg.syncSource, status, processed);
    return {
      dataset: "transactions-2025",
      ok: true,
      processed,
      source: remote.length > 0 ? "live" : "empty",
    };
  });
}

export async function syncProjectsSherbrooke(): Promise<SyncResult> {
  const cfg = DATASETS["projects-sherbrooke"];
  return runSync("projects-sherbrooke", async () => {
    const remote = await fetchSherbrookeProjects();
    let processed = 0;
    for (const p of remote) {
      await prisma.developmentProject.upsert({
        where: { externalId: p.externalId },
        create: { ...p, sourceFetchedAt: new Date() },
        update: { ...p, sourceFetchedAt: new Date() },
      });
      processed++;
    }
    await persistSourceMetadata("projects-sherbrooke");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "projects-sherbrooke",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncProjectsBrossard(): Promise<SyncResult> {
  const cfg = DATASETS["projects-brossard"];
  return runSync("projects-brossard", async () => {
    const remote = await fetchBrossardProjects();
    let processed = 0;
    for (const p of remote) {
      await prisma.developmentProject.upsert({
        where: { externalId: p.externalId },
        create: { ...p, sourceFetchedAt: new Date() },
        update: { ...p, sourceFetchedAt: new Date() },
      });
      processed++;
    }
    await persistSourceMetadata("projects-brossard");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "projects-brossard",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncPermitsLevis(): Promise<SyncResult> {
  const cfg = DATASETS["permits-levis"];
  return runSync("permits-levis", async () => {
    const state = await prisma.syncState.findUnique({ where: { datasetId: "permits-levis" } });
    const minIssueDate = state?.cursor ? new Date(state.cursor) : undefined;
    const remote = await fetchLevisPermits(undefined, { minIssueDate });
    const processed = remote.length > 0 ? await upsertPermitRecords(remote, cfg.city) : 0;
    const newest = remote.find((p) => p.issueDate);
    if (newest?.issueDate) {
      await prisma.syncState.update({
        where: { datasetId: "permits-levis" },
        data: { cursor: newest.issueDate.toISOString() },
      });
    }
    await persistSourceMetadata("permits-levis");
    const status = remote.length > 0 ? "success" : "empty";
    await logSync(cfg.syncSource, status, processed);
    return {
      dataset: "permits-levis",
      ok: true,
      processed,
      source: remote.length > 0 ? "live" : "empty",
    };
  });
}

export async function syncZoningTroisRivieres(): Promise<SyncResult> {
  const cfg = DATASETS["zoning-trois-rivieres"];
  return runSync("zoning-trois-rivieres", async () => {
    const remote = await fetchZoningTroisRivieres();
    const { processed } = await upsertZoningPointBatch(remote);
    await persistSourceMetadata("zoning-trois-rivieres");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "zoning-trois-rivieres",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncRoadworksSaguenay(): Promise<SyncResult> {
  const cfg = DATASETS["roadworks-saguenay"];
  return runSync("roadworks-saguenay", async () => {
    const remote = await fetchRoadworksSaguenay();
    let processed = 0;
    for (const r of remote) {
      await prisma.roadWork.upsert({
        where: { externalId: r.externalId },
        create: { ...r, city: "Saguenay", sourceFetchedAt: new Date() },
        update: { ...r, city: "Saguenay", sourceFetchedAt: new Date() },
      });
      processed++;
    }
    await persistSourceMetadata("roadworks-saguenay");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "roadworks-saguenay",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

export async function syncContractsBoroughs(): Promise<SyncResult> {
  const cfg = DATASETS["contracts-boroughs"];
  return runSync("contracts-boroughs", async () => {
    const remote = await fetchMunicipalContractsForDataset("contracts-boroughs");
    let processed = 0;
    for (const c of remote) {
      await prisma.municipalContract.upsert({
        where: { externalId: c.externalId },
        create: { ...c, sourceFetchedAt: new Date() },
        update: { ...c, sourceFetchedAt: new Date() },
      });
      processed++;
    }
    await persistSourceMetadata("contracts-boroughs");
    await logSync(cfg.syncSource, remote.length ? "success" : "empty", processed);
    return {
      dataset: "contracts-boroughs",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

async function syncEnvPermitDataset(
  datasetId:
    | "permits-sherbrooke"
    | "permits-trois-rivieres"
    | "permits-saguenay"
    | "permits-terrebonne"
    | "permits-repentigny"
    | "permits-brossard"
    | "permits-saint-jean-richelieu"
    | "permits-drummondville"
    | "permits-saint-jerome"
    | "permits-granby"
    | "permits-saint-hyacinthe",
  fetcher: (opts?: { minIssueDate?: Date }) => Promise<Awaited<ReturnType<typeof fetchPermitsPaginated>>>
): Promise<SyncResult> {
  const cfg = DATASETS[datasetId];
  return runSync(datasetId, async () => {
    const state = await prisma.syncState.findUnique({ where: { datasetId } });
    const minIssueDate = state?.cursor ? new Date(state.cursor) : undefined;
    const remote = await fetcher({ minIssueDate });
    const processed = remote.length > 0 ? await upsertPermitRecords(remote, cfg.city) : 0;

    const newest = remote.find((p) => p.issueDate);
    if (newest?.issueDate) {
      await prisma.syncState.update({
        where: { datasetId },
        data: { cursor: newest.issueDate.toISOString() },
      });
    }

    await persistSourceMetadata(datasetId);
    await logSync(cfg.syncSource, remote.length > 0 ? "success" : "empty", processed);
    return {
      dataset: datasetId,
      ok: true,
      processed,
      source: remote.length > 0 ? "live" : "empty",
    };
  });
}

export async function syncPermitsSherbrooke(): Promise<SyncResult> {
  const { fetchSherbrookePermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-sherbrooke", (opts) => fetchSherbrookePermits(undefined, opts));
}

export async function syncPermitsTroisRivieres(): Promise<SyncResult> {
  const { fetchTroisRivieresPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-trois-rivieres", (opts) =>
    fetchTroisRivieresPermits(undefined, opts)
  );
}

export async function syncPermitsSaguenay(): Promise<SyncResult> {
  const { fetchSaguenayPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-saguenay", (opts) => fetchSaguenayPermits(undefined, opts));
}

export async function syncPermitsTerrebonne(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-terrebonne", (opts) =>
    fetchEnvCityPermits("permits-terrebonne", undefined, opts)
  );
}

export async function syncPermitsRepentigny(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-repentigny", (opts) =>
    fetchEnvCityPermits("permits-repentigny", undefined, opts)
  );
}

export async function syncPermitsBrossard(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-brossard", (opts) =>
    fetchEnvCityPermits("permits-brossard", undefined, opts)
  );
}

export async function syncPermitsSaintJeanRichelieu(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-saint-jean-richelieu", (opts) =>
    fetchEnvCityPermits("permits-saint-jean-richelieu", undefined, opts)
  );
}

export async function syncPermitsDrummondville(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-drummondville", (opts) =>
    fetchEnvCityPermits("permits-drummondville", undefined, opts)
  );
}

export async function syncPermitsSaintJerome(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-saint-jerome", (opts) =>
    fetchEnvCityPermits("permits-saint-jerome", undefined, opts)
  );
}

export async function syncPermitsGranby(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-granby", (opts) =>
    fetchEnvCityPermits("permits-granby", undefined, opts)
  );
}

export async function syncPermitsSaintHyacinthe(): Promise<SyncResult> {
  const { fetchEnvCityPermits } = await import("@/lib/datasets/fetchers/city-permits");
  return syncEnvPermitDataset("permits-saint-hyacinthe", (opts) =>
    fetchEnvCityPermits("permits-saint-hyacinthe", undefined, opts)
  );
}

export async function syncZoningSherbrooke(): Promise<SyncResult> {
  return runSync("zoning-sherbrooke", async () => {
    const { fetchZoningSherbrooke } = await import("@/lib/datasets/fetchers/zoning-regional");
    const remote = await fetchZoningSherbrooke();
    const { processed } = await upsertZoningPointBatch(remote);
    await persistSourceMetadata("zoning-sherbrooke");
    await logSync(DATASETS["zoning-sherbrooke"].syncSource, remote.length ? "success" : "empty", processed);
    return { dataset: "zoning-sherbrooke", ok: true, processed, source: remote.length ? "live" : "empty" };
  });
}

export async function syncZoningQuebec(): Promise<SyncResult> {
  return runSync("zoning-quebec", async () => {
    const { fetchZoningQuebec } = await import("@/lib/datasets/fetchers/zoning-regional");
    const remote = await fetchZoningQuebec();
    const { processed } = await upsertZoningPointBatch(remote);
    await persistSourceMetadata("zoning-quebec");
    await logSync(DATASETS["zoning-quebec"].syncSource, remote.length ? "success" : "empty", processed);
    return { dataset: "zoning-quebec", ok: true, processed, source: remote.length ? "live" : "empty" };
  });
}

export async function syncZoningLaval(): Promise<SyncResult> {
  return runSync("zoning-laval", async () => {
    const { fetchZoningLaval } = await import("@/lib/datasets/fetchers/zoning-regional");
    const remote = await fetchZoningLaval();
    const { processed } = await upsertZoningPointBatch(remote);
    await persistSourceMetadata("zoning-laval");
    await logSync(DATASETS["zoning-laval"].syncSource, remote.length ? "success" : "empty", processed);
    return { dataset: "zoning-laval", ok: true, processed, source: remote.length ? "live" : "empty" };
  });
}

export async function syncZoningLongueuil(): Promise<SyncResult> {
  return runSync("zoning-longueuil", async () => {
    const { fetchZoningLongueuil } = await import("@/lib/datasets/fetchers/zoning-regional");
    const remote = await fetchZoningLongueuil();
    const { processed } = await upsertZoningPointBatch(remote);
    await persistSourceMetadata("zoning-longueuil");
    await logSync(
      DATASETS["zoning-longueuil"].syncSource,
      remote.length ? "success" : "empty",
      processed
    );
    return {
      dataset: "zoning-longueuil",
      ok: true,
      processed,
      source: remote.length ? "live" : "empty",
    };
  });
}

async function syncRegulatoryScaffold(
  datasetId: "amp-registry" | "rbq-infractions" | "inspection-violations-mtl"
): Promise<SyncResult> {
  const cfg = DATASETS[datasetId];
  return runSync(datasetId, async () => {
    const { fetchRegulatoryCsv } = await import("@/lib/datasets/fetchers/regulatory-scaffold");
    let processed = 0;
    const rows = await fetchRegulatoryCsv(datasetId);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const { pick } = await import("@/lib/datasets/parser");
      if (datasetId === "amp-registry") {
        const licenseNumber = pick(row, "numero", "license", "licence") || `amp-${i}`;
        await prisma.ampAuthorization.upsert({
          where: { licenseNumber },
          create: {
            licenseNumber,
            holderName: pick(row, "nom", "name") || undefined,
            ampClass: pick(row, "classe", "class") || undefined,
            status: pick(row, "statut", "status") || "active",
            sourceUrl: cfg.sourceUrl,
          },
          update: {
            holderName: pick(row, "nom", "name") || undefined,
            ampClass: pick(row, "classe", "class") || undefined,
            status: pick(row, "statut", "status") || "active",
            sourceFetchedAt: new Date(),
          },
        });
      } else if (datasetId === "rbq-infractions") {
        const externalId = pick(row, "id", "numero") || `rbq-inf-${i}`;
        await prisma.rbqInfraction.upsert({
          where: { externalId },
          create: {
            externalId,
            licenseNumber: pick(row, "licence", "license") || undefined,
            holderName: pick(row, "nom", "name") || undefined,
            description: pick(row, "description", "infraction") || undefined,
            sourceUrl: cfg.sourceUrl,
          },
          update: {
            licenseNumber: pick(row, "licence", "license") || undefined,
            holderName: pick(row, "nom", "name") || undefined,
            description: pick(row, "description", "infraction") || undefined,
            sourceFetchedAt: new Date(),
          },
        });
      } else {
        const externalId = pick(row, "id", "numero") || `insp-${i}`;
        await prisma.municipalInspection.upsert({
          where: { externalId },
          create: {
            externalId,
            city: cfg.city ?? "Montréal",
            address: pick(row, "adresse", "address") || undefined,
            violationType: pick(row, "type", "infraction") || undefined,
            sourceUrl: cfg.sourceUrl,
          },
          update: {
            address: pick(row, "adresse", "address") || undefined,
            violationType: pick(row, "type", "infraction") || undefined,
            sourceFetchedAt: new Date(),
          },
        });
      }
      processed++;
    }
    await persistSourceMetadata(datasetId);
    await logSync(cfg.syncSource, processed ? "success" : "empty", processed);
    return { dataset: datasetId, ok: true, processed, source: processed ? "live" : "empty" };
  });
}

export async function syncAmpRegistry(): Promise<SyncResult> {
  return syncRegulatoryScaffold("amp-registry");
}

export async function syncRbqInfractions(): Promise<SyncResult> {
  return syncRegulatoryScaffold("rbq-infractions");
}

export async function syncSeaoStandingOffers(): Promise<SyncResult> {
  const cfg = DATASETS["seao-standing-offers"];
  return runSync("seao-standing-offers", async () => {
    const { fetchSeaoStandingOffers } = await import(
      "@/lib/datasets/fetchers/seao-standing-offers"
    );
    const remote = await fetchSeaoStandingOffers();
    let processed = 0;
    for (const t of remote) {
      await prisma.tender.upsert({
        where: { externalId: t.externalId },
        create: {
          externalId: t.externalId,
          title: t.title,
          organization: t.organization,
          category: t.category,
          region: t.region,
          estimatedValue: t.estimatedValue,
          publishedAt: t.publishedAt,
          closesAt: t.closesAt,
          summary: t.summary,
          description: t.description,
          requiresAmp: t.requiresAmp ?? false,
          sourceUrl: t.sourceUrl,
          unspsc: t.unspsc,
          status: t.status ?? "standing",
        },
        update: {
          title: t.title,
          organization: t.organization,
          category: t.category,
          region: t.region,
          estimatedValue: t.estimatedValue,
          publishedAt: t.publishedAt,
          closesAt: t.closesAt,
          summary: t.summary,
          description: t.description,
          sourceUrl: t.sourceUrl,
          unspsc: t.unspsc,
          status: t.status ?? "standing",
        },
      });
      processed++;
    }
    await persistSourceMetadata("seao-standing-offers");
    await logSync(cfg.syncSource, processed ? "success" : "empty", processed);
    return {
      dataset: "seao-standing-offers",
      ok: true,
      processed,
      source: processed ? "live" : "empty",
    };
  });
}

export async function syncInspectionViolationsMtl(): Promise<SyncResult> {
  return syncRegulatoryScaffold("inspection-violations-mtl");
}

export async function syncTorontoPermitsScaffold(): Promise<SyncResult> {
  return runSync("toronto-permits", async () => {
    if (process.env.EXPAND_ONTARIO !== "true") {
      await persistSourceMetadata("toronto-permits");
      return { dataset: "toronto-permits", ok: true, processed: 0, source: "skipped" };
    }
    const url = process.env.TORONTO_PERMITS_URL;
    if (!url) {
      await persistSourceMetadata("toronto-permits");
      return { dataset: "toronto-permits", ok: true, processed: 0, source: "empty" };
    }
    const { fetchText } = await import("@/lib/datasets/client");
    const { parseCsvText, pick, parseMoney, parseDate } = await import("@/lib/datasets/parser");
    const text = await fetchText(url, 25_000_000);
    if (!text) {
      await persistSourceMetadata("toronto-permits");
      return { dataset: "toronto-permits", ok: true, processed: 0, source: "empty" };
    }
    const { rows } = parseCsvText(text, getSyncLimit("toronto-permits"));
    let processed = 0;
    for (const row of rows) {
      const externalId = pick(row, "id", "permit_num", "permit_number") || `toronto-${processed}`;
      await prisma.permit.upsert({
        where: { externalId: `toronto-permits-${externalId}` },
        create: {
          externalId: `toronto-permits-${externalId}`,
          permitType: pick(row, "permit_type", "work", "description") || "Building",
          address: pick(row, "address", "street") || "Toronto",
          city: "Toronto",
          estimatedCost: parseMoney(pick(row, "value", "est_cost", "cost")),
          issueDate: parseDate(pick(row, "issued_date", "issue_date", "date")),
          sourceUrl: DATASETS["toronto-permits"].sourceUrl,
        },
        update: {
          permitType: pick(row, "permit_type", "work", "description") || "Building",
          address: pick(row, "address", "street") || "Toronto",
          estimatedCost: parseMoney(pick(row, "value", "est_cost", "cost")),
          issueDate: parseDate(pick(row, "issued_date", "issue_date", "date")),
        },
      });
      processed++;
    }
    await persistSourceMetadata("toronto-permits");
    await logSync(DATASETS["toronto-permits"].syncSource, processed ? "success" : "empty", processed);
    return {
      dataset: "toronto-permits",
      ok: true,
      processed,
      source: processed > 0 ? "live" : "empty",
    };
  });
}

const SYNC_FNS: Partial<Record<DatasetId, (limit?: number) => Promise<SyncResult>>> = {
  permits: syncPermits,
  "permits-laval": () => syncPermitsLaval(),
  "permits-longueuil": () => syncPermitsLongueuil(),
  "permits-quebec": () => syncPermitsQuebec(),
  "permits-gatineau": () => syncPermitsGatineau(),
  "permit-stats": syncPermitStats,
  tenders: syncTenders,
  suppliers: syncSuppliers,
  transactions: syncTransactions,
  "transactions-2023": syncTransactions2023,
  assessment: syncAssessments,
  contamination: syncContamination,
  commercial: syncCommercial,
  taxes: syncTaxes,
  registre: syncRegistre,
  awards: syncAwards,
  rbq: syncRbq,
  heritage: () => syncHeritage(),
  "heritage-eip": () => syncHeritageEip(),
  contracts: syncContracts,
  roadworks: syncRoadworks,
  zoning: () => syncZoning(),
  "pum2050-zoning": () => syncPum2050Zoning(),
  "contamination-gtc": () => syncContaminationGtc(),
  "heritage-lpc": () => syncHeritageLpc(),
  "pum2050-heritage": () => syncPum2050Heritage(),
  "permit-delays": () => syncPermitDelays(),
  "transactions-2025": () => syncTransactions2025(),
  "projects-sherbrooke": () => syncProjectsSherbrooke(),
  "projects-brossard": () => syncProjectsBrossard(),
  "permits-levis": () => syncPermitsLevis(),
  "zoning-trois-rivieres": () => syncZoningTroisRivieres(),
  "roadworks-saguenay": () => syncRoadworksSaguenay(),
  "contracts-boroughs": () => syncContractsBoroughs(),
  "permits-sherbrooke": () => syncPermitsSherbrooke(),
  "permits-trois-rivieres": () => syncPermitsTroisRivieres(),
  "permits-saguenay": () => syncPermitsSaguenay(),
  "permits-terrebonne": () => syncPermitsTerrebonne(),
  "permits-repentigny": () => syncPermitsRepentigny(),
  "permits-brossard": () => syncPermitsBrossard(),
  "permits-saint-jean-richelieu": () => syncPermitsSaintJeanRichelieu(),
  "permits-drummondville": () => syncPermitsDrummondville(),
  "permits-saint-jerome": () => syncPermitsSaintJerome(),
  "permits-granby": () => syncPermitsGranby(),
  "permits-saint-hyacinthe": () => syncPermitsSaintHyacinthe(),
  "zoning-sherbrooke": () => syncZoningSherbrooke(),
  "zoning-quebec": () => syncZoningQuebec(),
  "zoning-laval": () => syncZoningLaval(),
  "zoning-longueuil": () => syncZoningLongueuil(),
  "amp-registry": () => syncAmpRegistry(),
  "rbq-infractions": () => syncRbqInfractions(),
  "seao-standing-offers": () => syncSeaoStandingOffers(),
  "inspection-violations-mtl": () => syncInspectionViolationsMtl(),
  "toronto-permits": () => syncTorontoPermitsScaffold(),
};

export async function syncDataset(datasetId: DatasetId): Promise<SyncResult> {
  if (!isDatasetSyncEnabled(datasetId)) {
    return {
      dataset: datasetId,
      ok: true,
      processed: 0,
      source: "skipped",
      error: "Dataset is registered for coverage only and is not sync-enabled.",
    };
  }
  const fn = SYNC_FNS[datasetId];
  if (!fn) {
    return {
      dataset: datasetId,
      ok: false,
      processed: 0,
      source: "error",
      error: "No sync adapter registered for dataset.",
    };
  }
  return fn();
}

export async function syncAll(
  datasets?: DatasetId[]
): Promise<{ results: SyncResult[]; totalProcessed: number }> {
  const ids = datasets ?? (Object.keys(SYNC_FNS) as DatasetId[]).filter(isDatasetSyncEnabled);
  const results: SyncResult[] = [];
  const batchSize = 4;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((id) => syncDataset(id)));
    results.push(...batchResults);
  }

  const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
  await logSync("sync-all", "complete", totalProcessed);
  return { results, totalProcessed };
}

export async function getSyncStatus() {
  const [logs, states, counts] = await Promise.all([
    prisma.syncLog.findMany({ orderBy: { ranAt: "desc" }, take: 50 }),
    prisma.syncState.findMany({ orderBy: { datasetId: "asc" } }),
    Promise.all([
      prisma.permit.count(),
      prisma.tender.count(),
      prisma.company.count(),
      prisma.municipalSupplier.count(),
      prisma.propertyUnit.count(),
      prisma.propertyTransaction.count(),
      prisma.contaminatedSite.count(),
      prisma.commercialVacancy.count(),
      prisma.propertyTax.count(),
      prisma.tenderAward.count(),
      prisma.rbqLicense.count(),
      prisma.heritageSite.count(),
      prisma.municipalContract.count(),
      prisma.roadWork.count(),
      prisma.boroughPermitStat.count(),
    ]),
  ]);

  const [
    permits,
    tenders,
    companies,
    suppliers,
    assessments,
    transactions,
    contamination,
    commercial,
    taxes,
    awards,
    rbqLicenses,
    heritage,
    contracts,
    roadworks,
    permitStats,
  ] = counts;

  return {
    logs,
    states,
    counts: {
      permits,
      tenders,
      companies,
      suppliers,
      assessments,
      transactions,
      contamination,
      commercial,
      taxes,
      awards,
      rbqLicenses,
      heritage,
      contracts,
      roadworks,
      permitStats,
    },
  };
}
