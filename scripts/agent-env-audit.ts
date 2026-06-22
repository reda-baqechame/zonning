/**
 * Safe credential audit for coding agents — prints SET/MISSING only, never values.
 * Loads: .env.production.local → .env.production.secrets → .env.local → .env
 */
import { loadProdEnv } from "./load-prod-env";
import { collectEnvIssues, getIntegrationStatus } from "../src/lib/env";
import { resolveDatabaseUrl } from "../src/lib/env-resolve";
import { COVERAGE_CITIES, getDatasetCount } from "../src/lib/datasets/registry";

loadProdEnv();

function status(key: string, ok: boolean) {
  return `${ok ? "SET" : "MISSING"}  ${key}`;
}

function has(key: string) {
  return Boolean(process.env[key]?.trim());
}

const CORE_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "CRON_SECRET",
  "SESSION_SECRET",
  "NEXT_PUBLIC_APP_URL",
  "ADMIN_EMAILS",
  "SYNC_ENABLED",
  "UPSTASH_REDIS_REST_URL",
  "KV_REST_API_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_TOKEN",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

const OPTIONAL_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ESSENTIEL",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_EQUIPE",
  "STRIPE_PRICE_CONCIERGE",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM",
  "OPENAI_API_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
] as const;

const SCAFFOLD_KEYS = [
  "LEVIS_PERMITS_URL",
  "LONGUEUIL_PERMITS_URL",
  "GATINEAU_PERMITS_CKAN_ID",
  "GATINEAU_PERMITS_STATS_URL",
  "SHERBROOKE_PERMITS_URL",
  "V3R_PERMITS_URL",
  "SAGUENAY_PERMITS_URL",
  "TERREBONNE_PERMITS_URL",
  "REPENTIGNY_PERMITS_URL",
  "BROSSARD_PERMITS_URL",
  "BROSSARD_PROJECTS_URL",
  "SJR_PERMITS_URL",
  "DRUMMONDVILLE_PERMITS_URL",
  "SAINT_JEROME_PERMITS_URL",
  "GRANBY_PERMITS_URL",
  "SAINT_HYACINTHE_PERMITS_URL",
  "SHERBROOKE_ZONING_URL",
  "QUEBEC_ZONING_URL",
  "LAVAL_ZONING_URL",
  "LONGUEUIL_ZONING_URL",
  "AMP_REGISTRY_URL",
  "RBQ_INFRACTIONS_URL",
  "MTL_INSPECTIONS_URL",
] as const;

console.log("ZONNING agent env audit (no secret values printed)\n");
console.log(`App: ${process.env.NEXT_PUBLIC_APP_URL ?? "(unset)"}`);
console.log(`Datasets: ${getDatasetCount()} · Cities: ${COVERAGE_CITIES.length}\n`);

console.log("— Core (required for production)");
console.log(status("database (resolved)", Boolean(resolveDatabaseUrl())));
for (const k of CORE_KEYS) console.log(status(k, has(k)));

console.log("\n— Integrations");
const integrations = getIntegrationStatus();
for (const [k, v] of Object.entries(integrations)) {
  console.log(`${v ? "SET" : "MISSING"}  integration:${k}`);
}

console.log("\n— Optional billing / alerts / AI");
for (const k of OPTIONAL_KEYS) console.log(status(k, has(k)));

console.log("\n— Quebec scaffold URLs (empty = dataset may have 0 rows)");
const scaffoldSet = SCAFFOLD_KEYS.filter(has).length;
console.log(`Configured: ${scaffoldSet}/${SCAFFOLD_KEYS.length}`);
for (const k of SCAFFOLD_KEYS) console.log(status(k, has(k)));

console.log("\n— Validation");
const issues = collectEnvIssues();
const errors = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warn");
if (errors.length === 0 && warns.length === 0) {
  console.log("No blocking env errors (NODE_ENV=%s)", process.env.NODE_ENV ?? "development");
} else {
  for (const i of [...errors, ...warns]) {
    console.log(`${i.severity.toUpperCase()}  ${i.key}: ${i.message}`);
  }
}

console.log("\n— Agent quick refs");
console.log("Demo login: demo@zonning.ca / demo1234 (after npm run db:seed)");
console.log("Prod health:  GET /api/health");
console.log("Sync auth:    Authorization: Bearer $CRON_SECRET");
console.log("Pull Vercel:  npx vercel env pull .env.production.local --environment=production");
console.log("GitHub cron:  secrets APP_URL + CRON_SECRET");
console.log(
  "Upstash alias: KV_REST_API_URL + KV_REST_API_TOKEN work as UPSTASH_REDIS_*"
);
console.log(
  "DB alias: POSTGRES_PRISMA_URL works as DATABASE_URL"
);

const dbOk = Boolean(resolveDatabaseUrl());
const cronOk = has("CRON_SECRET") && has("SESSION_SECRET");
const urlOk = has("NEXT_PUBLIC_APP_URL");

console.log("\n— Ready for agent tasks");
console.log(`Local dev (SQLite):     npm run dev`);
console.log(`Prod ops (needs DB+URL): ${dbOk && urlOk && cronOk ? "yes" : "partial — see MISSING above"}`);
console.log(`Full prod checklist:    npm run launch-checklist`);

if (errors.length > 0) process.exit(1);
