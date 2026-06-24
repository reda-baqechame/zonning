import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { loadProdEnv } from "./load-prod-env";
import { getBootstrapAllowlist, getActiveDatasetIds, COVERAGE_CITIES, getDatasetCount, getRegisteredSourceCount } from "../src/lib/datasets/registry";
import { honestCoverageCount } from "../src/lib/quebec-coverage";
import { collectEnvIssues } from "../src/lib/env";

loadProdEnv();

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;

/** Datasets allowed to be missing after bootstrap (CKAN not yet live). */
const BOOTSTRAP_ALLOWLIST = new Set(getBootstrapAllowlist());

async function check(path: string, method = "GET", expectStatus?: number) {
  const headers: Record<string, string> = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(`${base}${path}`, { method, headers });
  const text = await res.text();
  const ok = expectStatus != null ? res.status === expectStatus : res.ok;
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${res.status} ${method} ${path}`);
  try {
    const json = JSON.parse(text);
    const preview = JSON.stringify(json, null, 2).slice(0, 800);
    console.log(preview);
    return { ok, json };
  } catch {
    console.log(text.slice(0, 200));
    return { ok, json: null };
  }
}

/**
 * Fail fast if sync is enabled but vercel.json declares no crons — that's the
 * "no ingestion in production" footgun (public routes no longer sync on
 * request, so an empty cron list means the database never refreshes).
 */
function checkCronConfig(): boolean {
  if (process.env.SYNC_ENABLED === "false") {
    console.log("• SYNC_ENABLED=false — cron config check skipped");
    return true;
  }
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as { crons?: unknown[] };
    const count = Array.isArray(cfg.crons) ? cfg.crons.length : 0;
    if (count === 0) {
      console.log("✗ vercel.json has no crons while SYNC_ENABLED is on — production will never ingest data.");
      console.log("  Fix: copy vercel.hobby.json (daily) or vercel.pro.json (sub-hourly) into vercel.json.");
      return false;
    }
    console.log(`✓ vercel.json declares ${count} crons`);
    return true;
  } catch (e) {
    console.log(`✗ Could not read vercel.json: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function main() {
  console.log("ZONNING deploy verification\n");
  console.log(`Target: ${base}\n`);

  if (!secret) {
    console.warn("⚠ CRON_SECRET not set — full health check requires auth\n");
  }

  const cronOk = checkCronConfig();

  const activeIds = getActiveDatasetIds();
  const requiredIds = activeIds.filter((id) => !BOOTSTRAP_ALLOWLIST.has(id));

  const checks: { name: string; run: () => Promise<boolean> }[] = [
    { name: "liveness /api/health", run: async () => (await check("/api/health")).ok },
    { name: "sync health (auth)", run: async () => (await check("/api/sync/health")).ok },
    { name: "sync status (auth)", run: async () => (await check("/api/sync/status")).ok },
    {
      name: `public stats (${getDatasetCount()} sync-enabled, ${honestCoverageCount()} covered cities)`,
      run: async () => {
        const { ok, json } = await check("/api/stats/public");
        if (!ok || !json) return false;
        const expected = getDatasetCount();
        const registered = getRegisteredSourceCount();
        const countOk =
          json.datasetCount === expected ||
          json.datasetCount === registered ||
          (typeof json.datasetCount === "number" && json.datasetCount >= expected);
        // coverageCities is now the HONEST count (sync-enabled permit feeds
        // only), not COVERAGE_CITIES.length which counts placeholders too.
        const honest = honestCoverageCount();
        const citiesOk =
          json.coverageCities === honest && Array.isArray(json.cities);
        console.log(
          `datasetCount=${json.datasetCount} (expect ${expected} or ${registered}), honestCities=${json.coverageCities}/${honest}`
        );
        return countOk && citiesOk;
      },
    },
    { name: "coverage public API", run: async () => (await check("/api/coverage/public")).ok },
    {
      name: "feed permit carries derived value + contact + parcel",
      run: async () => {
        const res = await fetch(`${base}/api/feed?limit=20&locale=fr`);
        const json = (await res.json()) as {
          items?: {
            kind: string;
            opportunityDossier?: {
              valueEstimate?: { kind: string; basis?: string[] };
              contactLeads?: { permit?: { note?: string } };
              parcelVerdict?: { status: string };
            };
          }[];
        };
        const permits = (json.items ?? []).filter((i) => i.kind === "permit");
        const withValue = permits.filter((p) => p.opportunityDossier?.valueEstimate);
        const withContact = permits.filter((p) => p.opportunityDossier?.contactLeads);
        const withParcel = permits.filter((p) => p.opportunityDossier?.parcelVerdict);
        console.log(
          `permits=${permits.length} value=${withValue.length} contact=${withContact.length} parcel=${withParcel.length}`,
        );
        if (withValue[0]) {
          const v = withValue[0].opportunityDossier!.valueEstimate!;
          console.log(`  valueEstimate.kind=${v.kind} basis0="${v.basis?.[0] ?? ""}"`);
        }
        if (withContact[0]) {
          console.log(
            `  contactLeads note: "${withContact[0].opportunityDossier!.contactLeads!.permit?.note?.slice(0, 70)}"`,
          );
        }
        // Hard requirement: at least one permit must carry the new intelligence,
        // or the deploy is not "working" regardless of HTTP 200s.
        return (
          permits.length > 0 &&
          withValue.length > 0 &&
          withContact.length > 0 &&
          withParcel.length > 0
        );
      },
    },
    { name: "digest preview", run: async () => (await check("/api/digest")).ok },
    {
      name: "map overlays",
      run: async () => {
        const { ok } = await check("/api/map/overlays?lat=45.5017&lng=-73.5673&layers=gtc");
        return ok;
      },
    },
    { name: "verdict slug 404", run: async () => (await check("/api/verdict?slug=invalid", "GET", 404)).ok },
    {
      name: `dataset bootstrap ${requiredIds.length}/${activeIds.length}`,
      run: async () => {
        if (!secret) {
          console.log("Skipped — set CRON_SECRET for full dataset check");
          return true;
        }
        const { ok, json } = await check("/api/sync/health");
        if (!ok || !json?.datasets) return false;

        const datasets = json.datasets as {
          id: string;
          lastSuccessAt?: string | null;
          anomaly?: boolean;
        }[];
        const missing = requiredIds.filter(
          (id) => !datasets.find((d) => d.id === id)?.lastSuccessAt
        );
        const anomalies = datasets.filter((d) => d.anomaly).length;

        console.log(
          `Coverage: ${requiredIds.length - missing.length}/${requiredIds.length} required datasets`
        );
        if (missing.length > 0) {
          console.log(`Missing lastSuccessAt: ${missing.join(", ")}`);
        }
        console.log(`Quality anomalies: ${anomalies}`);
        console.log(`Allowlisted (may be empty): ${[...BOOTSTRAP_ALLOWLIST].join(", ")}`);

        const coverageOk = missing.length === 0;
        const anomaliesOk = anomalies === 0 || process.env.CI === "true";
        if (process.env.CI === "true" && anomalies > 0) {
          console.log("CI: ignoring quality anomalies (production data drift)");
        }
        return coverageOk && anomaliesOk;
      },
    },
    {
      name: "env validation (no errors)",
      run: async () => {
        const errors = collectEnvIssues().filter((i) => i.severity === "error");
        if (errors.length > 0) {
          console.log(errors.map((e) => `${e.key}: ${e.message}`).join("; "));
        }
        return errors.length === 0;
      },
    },
    {
      name: "cron live (auth)",
      run: async () => (secret ? (await check("/api/cron/sync?mode=live", "POST")).ok : true),
    },
    {
      name: "cron scheduler (auth)",
      run: async () =>
        secret ? (await check("/api/cron/sync?mode=scheduler", "POST")).ok : true,
    },
    {
      name: "cron stats (auth)",
      run: async () => (secret ? (await check("/api/cron/stats", "POST")).ok : true),
    },
    {
      name: "cron alerts (auth)",
      run: async () => (secret ? (await check("/api/cron/alerts", "POST")).ok : true),
    },
    {
      name: "cron alerts live (auth)",
      run: async () =>
        secret ? (await check("/api/cron/alerts?mode=live", "POST")).ok : true,
    },
    {
      name: "cron rgm (auth)",
      run: async () => (secret ? (await check("/api/cron/sync?mode=rgm", "POST")).ok : true),
    },
    {
      name: "cron thursday (auth)",
      run: async () => (secret ? (await check("/api/cron/thursday", "POST")).ok : true),
    },
  ];

  console.log(`Active datasets: ${activeIds.length} · Coverage cities: ${COVERAGE_CITIES.length}\n`);

  let passed = 0;
  for (const c of checks) {
    console.log(`\n— ${c.name}`);
    if (await c.run()) passed++;
  }

  console.log(`\n${passed}/${checks.length} checks passed`);
  if (passed < checks.length || !cronOk) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
