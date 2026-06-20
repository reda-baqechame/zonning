import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/email/html";
import type { DatasetId } from "@/lib/datasets/registry";

const INCREMENTAL_CURSOR_DATASETS: DatasetId[] = [
  "permits",
  "permits-laval",
  "permits-longueuil",
  "permits-quebec",
  "permits-gatineau",
  "tenders",
];
import { evaluateQuality } from "./quality-rules";
import { DATASETS } from "@/lib/datasets/registry";
import { fetchCkanPackage, fetchCkanDatastoreTotal } from "@/lib/datasets/client";

export type QualitySyncInput = {
  ok: boolean;
  processed: number;
  source: string;
};

const ROW_COUNT_QUERIES: Partial<Record<DatasetId, () => Promise<number>>> = {
  permits: () => prisma.permit.count(),
  "permits-laval": () => prisma.permit.count({ where: { city: "Laval" } }),
  "permits-longueuil": () => prisma.permit.count({ where: { city: "Longueuil" } }),
  "permits-quebec": () => prisma.permit.count({ where: { city: "Québec" } }),
  "permits-gatineau": () => prisma.permit.count({ where: { city: "Gatineau" } }),
  tenders: () => prisma.tender.count(),
  rbq: () => prisma.rbqLicense.count(),
  registre: () => prisma.company.count(),
  suppliers: () => prisma.municipalSupplier.count(),
  "pum2050-zoning": () => prisma.zoningPoint.count({ where: { city: "Montréal" } }),
  "contamination-gtc": () => prisma.contaminatedSite.count({ where: { sourceLayer: "gtc" } }),
  "permit-delays": () => prisma.boroughPermitDelay.count(),
  "projects-sherbrooke": () => prisma.developmentProject.count({ where: { city: "Sherbrooke" } }),
};

async function medianIngested(datasetId: DatasetId): Promise<number | undefined> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const checks = await prisma.datasetQualityCheck.findMany({
    where: { datasetId, checkedAt: { gte: since }, status: "ok" },
    orderBy: { checkedAt: "desc" },
    take: 20,
    select: { rowsIngested: true },
  });
  if (checks.length === 0) return undefined;
  const sorted = checks.map((c) => c.rowsIngested).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export async function recordQualityCheck(
  datasetId: DatasetId,
  result: QualitySyncInput,
  durationMs: number
): Promise<{ status: string; message?: string }> {
  const state = await prisma.syncState.findUnique({ where: { datasetId } });
  const hadPriorSuccess = Boolean(state?.lastSuccessAt);
  const priorMedian = await medianIngested(datasetId);

  const isIncrementalSync =
    INCREMENTAL_CURSOR_DATASETS.includes(datasetId) && Boolean(state?.cursor);

  const { status, message } = evaluateQuality({
    datasetId,
    rowsIngested: result.processed,
    hadPriorSuccess,
    priorMedianIngested: priorMedian,
    syncOk: result.ok,
    source: result.source,
    isIncrementalSync,
  });

  const countFn = ROW_COUNT_QUERIES[datasetId];
  const rowsInDb = countFn ? await countFn() : undefined;

  let coverageMessage: string | undefined;
  if (rowsInDb != null && rowsInDb > 0) {
    try {
      const cfg = DATASETS[datasetId];
      const pkg = await fetchCkanPackage(cfg.ckanId, cfg.ckanHost ?? "quebec");
      const csvRes = pkg?.resources.find(
        (r) => r.format?.toUpperCase() === "CSV" || r.url?.toLowerCase().endsWith(".csv")
      );
      if (csvRes?.id) {
        const total = await fetchCkanDatastoreTotal(csvRes.id, cfg.ckanHost ?? "quebec");
        if (total && rowsInDb < total * 0.5) {
          coverageMessage = `CKAN coverage ${((rowsInDb / total) * 100).toFixed(0)}% (${rowsInDb}/${total})`;
        }
      }
    } catch {
      /* optional CKAN total */
    }
  }

  const finalMessage = [message, coverageMessage].filter(Boolean).join("; ") || undefined;

  await prisma.syncState.upsert({
    where: { datasetId },
    create: { datasetId, status: "idle" },
    update: {},
  });

  await prisma.datasetQualityCheck.create({
    data: {
      datasetId,
      rowsIngested: result.processed,
      rowsInDb,
      durationMs,
      status,
      message: finalMessage,
      sourceModifiedAt: state?.sourceModifiedAt ?? null,
    },
  });

  return { status, message: finalMessage };
}

export async function getLatestQualityByDataset(): Promise<
  Map<string, { status: string; message?: string | null; checkedAt: Date }>
> {
  const checks = await prisma.datasetQualityCheck.findMany({
    orderBy: { checkedAt: "desc" },
    take: 100,
  });
  const map = new Map<string, { status: string; message?: string | null; checkedAt: Date }>();
  for (const c of checks) {
    if (!map.has(c.datasetId)) {
      map.set(c.datasetId, { status: c.status, message: c.message, checkedAt: c.checkedAt });
    }
  }
  return map;
}

export async function alertIfQualityAnomalies(): Promise<void> {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (admins.length === 0 || !process.env.RESEND_API_KEY) return;

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const anomalies = await prisma.datasetQualityCheck.findMany({
    where: { status: "anomaly", checkedAt: { gte: since } },
    orderBy: { checkedAt: "desc" },
    take: 10,
  });
  if (anomalies.length === 0) return;

  const { sendEmail } = await import("@/lib/email/resend");
  const lines = anomalies
    .map((a) => `- ${a.datasetId}: ${a.message ?? "anomaly"} (${a.rowsIngested} rows)`)
    .join("\n");

  for (const to of admins) {
    await sendEmail({
      to,
      subject: `[ZONNING] ${anomalies.length} dataset quality anomaly(ies)`,
      html: `<p>Data quality checks flagged issues:</p><pre>${escapeHtml(lines)}</pre>`,
    });
  }
}
