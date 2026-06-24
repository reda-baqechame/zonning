import { loadProdEnv } from "./load-prod-env";

loadProdEnv();

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.vercel.app";
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("CRON_SECRET missing");
  process.exit(1);
}

const datasets = [
  "rena",
  "sanctions",
  "convictions",
  "injuries",
  "market-index",
  "cadastre",
  "zoning-standard",
  "registre-entreprises",
] as const;

async function syncOne(id: string, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/cron/sync?dataset=${id}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
    });
    const text = await res.text();
    console.log(`${id}: ${res.status} ${text.slice(0, 300)}`);
    return res.ok;
  } catch (e) {
    console.log(`${id}: ERROR ${e instanceof Error ? e.message : String(e)}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  for (const id of datasets) {
    const timeout = id === "registre-entreprises" ? 240_000 : 120_000;
    await syncOne(id, timeout);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
