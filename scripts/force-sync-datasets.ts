import { execSync } from "child_process";
import { subMinutes } from "date-fns";
import { loadProdEnv } from "./load-prod-env";
import { ensureDbProvider } from "./ensure-db-provider";
import { resolveDatabaseUrl } from "../src/lib/env-resolve";
import { DATASETS, type DatasetId } from "../src/lib/datasets/registry";

loadProdEnv();

const url = resolveDatabaseUrl() ?? "";
if (!url.startsWith("postgres")) {
  console.error("Postgres URL required (.env.production.local + secrets)");
  process.exit(1);
}

process.env.DATABASE_URL = url;
ensureDbProvider(url);
execSync("npx prisma generate", { stdio: "inherit" });

const TARGETS: DatasetId[] = ["permits-longueuil", "registre", "rbq"];
const COOLDOWN_MINUTES = 15;

async function resetCircuit(
  prisma: typeof import("../src/lib/prisma").prisma,
  datasetIds: DatasetId[]
) {
  const sources = datasetIds.map((id) => DATASETS[id].syncSource);
  const since = subMinutes(new Date(), COOLDOWN_MINUTES);

  await prisma.syncState.updateMany({
    where: { datasetId: { in: datasetIds } },
    data: { status: "idle", lastError: null },
  });

  const deleted = await prisma.syncLog.deleteMany({
    where: {
      status: "error",
      source: { in: sources },
      ranAt: { gte: since },
    },
  });

  console.log(`Reset circuit for ${datasetIds.join(", ")} (cleared ${deleted.count} recent error logs)`);
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { syncDataset } = await import("../src/lib/sync/runner");

  const args = process.argv.slice(2);
  const datasets = (args.length > 0 ? args : TARGETS) as DatasetId[];

  for (const id of datasets) {
    if (!(id in DATASETS)) {
      console.error(`Unknown dataset: ${id}`);
      process.exit(1);
    }
  }

  console.log("ZONNING force sync\n");
  console.log(`Datasets: ${datasets.join(", ")}\n`);

  await resetCircuit(prisma, datasets);

  for (const id of datasets) {
    console.log(`\n— Syncing ${id} (${DATASETS[id].label})…`);
    const started = Date.now();
    const result = await syncDataset(id);
    const sec = ((Date.now() - started) / 1000).toFixed(1);
    console.log(JSON.stringify({ ...result, durationSec: sec }, null, 2));
  }

  console.log("\n— Sync state after force run:");
  for (const id of datasets) {
    const state = await prisma.syncState.findUnique({ where: { datasetId: id } });
    console.log(
      `  ${id}: status=${state?.status} processed=${state?.recordsProcessed} lastSuccess=${state?.lastSuccessAt?.toISOString() ?? "none"}`
    );
  }
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
