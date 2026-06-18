import "dotenv/config";
import { syncAll } from "../src/lib/sync/runner";

async function main() {
  console.log("ZONNING — syncing all Quebec datasets...\n");
  const { results, totalProcessed } = await syncAll();

  for (const r of results) {
    const icon = r.ok && r.processed > 0 ? "✓" : r.ok ? "○" : "✗";
    console.log(
      `${icon} ${r.dataset.padEnd(16)} ${String(r.processed).padStart(5)} records (${r.source})${r.error ? ` — ${r.error}` : ""}`
    );
  }

  console.log(`\nTotal: ${totalProcessed} records ingested`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
