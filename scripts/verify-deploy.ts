import "dotenv/config";
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

async function main() {
  console.log("ZONNING deploy verification\n");
  console.log(`Target: ${base}\n`);

  if (!secret) {
    console.warn("⚠ CRON_SECRET not set — full health check requires auth\n");
  }

  const activeIds = getActiveDatasetIds();
  const requiredIds = activeIds.filter((id) => !BOOTSTRAP_ALLOWLIST.has(id));

  const checks: { name: string; run: () => Promise<boolean> }[] = [
    { name: "liveness /api/health", run: async () => (await check("/api/health")).ok },
    { name: "sync health (auth)", run: async () => (await check("/api/sync/health")).ok },
    { name: "sync status (auth)", run: async () => (await check("/api/sync/status")).ok },
    {
      name: `public stats (${getDatasetCount()} sync-enabled, ${honestCoverageCount()} honest cities)`,
      run: async () => {
        const { ok, json } = await check("/api/stats/public");
        if (!ok || !json) return false;
        const expected = getDatasetCount();
        const registered = getRegisteredSourceCount();
        const honestCities = honestCoverageCount();
        const countOk =
          json.datasetCount === expected ||
          json.datasetCount === registered ||
          (typeof json.datasetCount === "number" && json.datasetCount >= expected);
        const citiesOk =
          json.coverageCities === honestCities &&
          Array.isArray(json.cities) &&
          json.cities.length === COVERAGE_CITIES.length;
        console.log(
          `datasetCount=${json.datasetCount} (expect ${expected} or ${registered}), honestCities=${json.coverageCities} (expect ${honestCities}), tracked=${json.cities?.length}`,
        );
        return countOk && citiesOk;
      },
    },
    { name: "coverage public API", run: async () => (await check("/api/coverage/public")).ok },
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
        const anomaliesOk = anomalies === 0;
        if (anomalies > 0) {
          console.log(
            `Warning: ${anomalies} quality anomalies (non-blocking unless VERIFY_STRICT=1)`,
          );
        }
        const strict = process.env.VERIFY_STRICT === "1";
        return coverageOk && (anomaliesOk || !strict);
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
    {
      name: "feed intelligence depth",
      run: async () => {
        const { ok, json } = await check("/api/feed?limit=60&locale=fr");
        if (!ok || !json || !Array.isArray(json.items)) return false;
        const permits = json.items.filter((i: { kind?: string }) => i.kind === "permit");
        const tenders = json.items.filter((i: { kind?: string }) => i.kind === "tender");
        const withValue = permits.filter(
          (p: { opportunityDossier?: { valueEstimate?: unknown } }) =>
            p.opportunityDossier?.valueEstimate,
        );
        const withContact = permits.filter(
          (p: { opportunityDossier?: { contactLeads?: unknown } }) =>
            p.opportunityDossier?.contactLeads,
        );
        const withParcel = permits.filter(
          (p: { opportunityDossier?: { parcelVerdict?: unknown } }) =>
            p.opportunityDossier?.parcelVerdict,
        );
        const withCompliance = tenders.filter(
          (t: { opportunityDossier?: { compliance?: unknown } }) => t.opportunityDossier?.compliance,
        );
        const withDecision = tenders.filter(
          (t: { opportunityDossier?: { decision?: { worthPursuing?: string; winProbability?: number } } }) =>
            t.opportunityDossier?.decision?.worthPursuing != null &&
            typeof t.opportunityDossier?.decision?.winProbability === "number",
        );
        const awarded = tenders.filter(
          (t: { opportunityDossier?: { contactLeads?: { tender?: { awardedContractor?: unknown } } } }) =>
            t.opportunityDossier?.contactLeads?.tender?.awardedContractor,
        );
        console.log(
          `permits=${permits.length} value=${withValue.length} contact=${withContact.length} parcel=${withParcel.length} tenders=${tenders.length} withCompliance=${withCompliance.length} withDecision=${withDecision.length} awarded=${awarded.length}`,
        );
        return (
          permits.length > 0 &&
          withValue.length > 0 &&
          withContact.length > 0 &&
          withParcel.length > 0 &&
          (tenders.length === 0 || withDecision.length > 0) &&
          (awarded.length === 0 || withCompliance.length > 0)
        );
      },
    },
  ];

  console.log(`Active datasets: ${activeIds.length} · Coverage cities: ${COVERAGE_CITIES.length}\n`);

  let passed = 0;
  for (const c of checks) {
    console.log(`\n— ${c.name}`);
    if (await c.run()) passed++;
  }

  console.log(`\n${passed}/${checks.length} checks passed`);
  if (passed < checks.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
