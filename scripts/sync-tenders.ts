#!/usr/bin/env npx tsx
/**
 * Sync SEAO tenders from Données Québec CKAN API.
 * Usage: npx tsx scripts/sync-tenders.ts
 */
import "dotenv/config";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const res = await fetch(`${base}/api/sync/tenders`, { method: "POST" });
  const data = await res.json();
  console.log(data);
}

main().catch(console.error);
