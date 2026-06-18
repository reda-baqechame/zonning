#!/usr/bin/env npx tsx
/**
 * Sync Montreal permits from Données Québec CKAN API.
 * Usage: npx tsx scripts/sync-permits.ts
 */
import "dotenv/config";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function main() {
  const res = await fetch(`${base}/api/sync/permits`, { method: "POST" });
  const data = await res.json();
  console.log(data);
}

main().catch(console.error);
