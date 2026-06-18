import "dotenv/config";
import { syncAll } from "../src/lib/sync/runner";

const INTERVAL_MS = 30 * 60 * 1000;

async function run() {
  console.log(`[${new Date().toISOString()}] Starting scheduled sync...`);
  const { results, totalProcessed } = await syncAll();
  for (const r of results) {
    console.log(`  ${r.dataset}: ${r.processed} (${r.source})`);
  }
  console.log(`Total: ${totalProcessed} records\n`);
}

console.log("ZONNING dev sync watcher — every 30 minutes. Ctrl+C to stop.\n");
void run();
setInterval(() => {
  void run();
}, INTERVAL_MS);
