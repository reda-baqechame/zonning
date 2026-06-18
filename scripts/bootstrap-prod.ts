import "dotenv/config";
import { loadProdEnv } from "./load-prod-env";

loadProdEnv();

/** Post-deploy bootstrap: chunked dataset sync then verify health. */
const base = process.env.NEXT_PUBLIC_APP_URL;
const secret = process.env.CRON_SECRET;

async function post(path: string) {
  if (!base || !secret) {
    console.error("Set NEXT_PUBLIC_APP_URL and CRON_SECRET");
    process.exit(1);
  }
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const text = await res.text();
  console.log(`${res.status} POST ${path}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 1200));
  } catch {
    console.log(text.slice(0, 400));
  }
  return res.ok;
}

async function get(path: string) {
  const res = await fetch(`${base}${path}`);
  console.log(`${res.status} GET ${path}`);
  const text = await res.text();
  console.log(text.slice(0, 400));
  return res.ok;
}

async function main() {
  console.log("ZONNING production bootstrap\n");
  console.log(`Target: ${base}\n`);

  await get("/api/health");

  console.log("\n— Bootstrap never-synced datasets (6 rounds)...");
  await post("/api/cron/sync?mode=bootstrap&rounds=6");

  console.log("\n— Chunked tier=all (4 scheduler batches)...");
  await post("/api/cron/sync?tier=all");

  console.log("\n— Waiting 45s for sync to progress...");
  await new Promise((r) => setTimeout(r, 45_000));

  console.log("\n— Running verify:deploy...");
  const { spawnSync } = await import("child_process");
  const result = spawnSync("npx", ["tsx", "scripts/verify-deploy.ts"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
