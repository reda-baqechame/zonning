import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { loadProdEnv } from "./load-prod-env";

const APP_URL = "https://zonning.vercel.app";
const ROOT = process.cwd();
const ENV_FILE = join(ROOT, ".env.production.local");

function run(cmd: string, optional = false): boolean {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env, cwd: ROOT });
    return true;
  } catch {
    if (!optional) {
      console.error(`\n✗ Failed: ${cmd}`);
      return false;
    }
    console.warn(`\n⚠ Skipped: ${cmd}`);
    return false;
  }
}

import {
  resolveDatabaseUrl,
  resolveUpstashRestToken,
  resolveUpstashRestUrl,
} from "../src/lib/env-resolve";

function vercelProductionEnvKeys(): Set<string> {
  try {
    const out = execSync("npx vercel env ls production", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const keys = new Set<string>();
    for (const line of out.split("\n")) {
      const m = line.match(/^\s+([A-Z0-9_]+)\s+/);
      if (m) keys.add(m[1]);
    }
    return keys;
  } catch {
    return new Set();
  }
}

function envPresent(key: string, remote: Set<string>): boolean {
  if (process.env[key]?.trim()) return true;
  return remote.has(key);
}

function missingKeys(): string[] {
  const remote = vercelProductionEnvKeys();
  const missing: string[] = [];
  if (!resolveDatabaseUrl()) missing.push("DATABASE_URL/POSTGRES_PRISMA_URL");
  if (!resolveUpstashRestUrl()) missing.push("UPSTASH/KV_REST_API_URL");
  if (!resolveUpstashRestToken()) missing.push("UPSTASH/KV_REST_API_TOKEN");
  for (const k of ["CRON_SECRET", "SESSION_SECRET", "NEXT_PUBLIC_APP_URL", "ADMIN_EMAILS"]) {
    if (!envPresent(k, remote)) missing.push(k);
  }
  if (!process.env.RESEND_API_KEY?.trim() && !remote.has("RESEND_API_KEY")) {
    missing.push("RESEND_API_KEY (warn)");
  }
  return missing;
}

async function checkRemoteHealth(): Promise<{ ready: boolean; missing?: string[] }> {
  const res = await fetch(`${APP_URL}/api/health`);
  const json = (await res.json()) as { ready?: boolean; missing?: string[] };
  console.log(JSON.stringify(json, null, 2));
  return { ready: Boolean(json.ready), missing: json.missing };
}

async function main() {
  console.log("═".repeat(60));
  console.log("ZONNING auto-finish — runs after you connect accounts");
  console.log("═".repeat(60));

  console.log("\n1/7 Pull env from Vercel …");
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, "# pulled from Vercel\n", "utf8");
  }
  run(`npx vercel env pull "${ENV_FILE}" --environment=production --yes`, true);
  loadProdEnv();

  if (!process.env.EMAIL_FROM?.trim()) {
    process.env.EMAIL_FROM = "ZONNING <onboarding@resend.dev>";
    console.log("Using default EMAIL_FROM (Resend test sender)");
  }

  const missing = missingKeys().filter((k) => !k.includes("(warn)"));
  if (missing.length > 0) {
    console.error(`
✗ Still missing on Vercel (connect integrations first):

${missing.map((k) => `  • ${k}`).join("\n")}

Connect here (one page, link to project "zonning"):
  https://vercel.com/redabaquechame58-2565s-projects/zonning/stores

Then say: "accounts connected, auto-finish"
`);
    process.exit(1);
  }

  if (!resolveDatabaseUrl()?.startsWith("postgres")) {
    console.error("✗ Database URL must be Postgres (POSTGRES_PRISMA_URL from Supabase integration)");
    process.exit(1);
  }

  process.env.DATABASE_URL = resolveDatabaseUrl();
  process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || APP_URL;

  if (!process.env.CRON_SECRET?.trim()) {
    console.warn(
      "\n⚠ CRON_SECRET is on Vercel but not readable locally (sensitive). " +
        "Bootstrap will be skipped unless .env.production.secrets contains CRON_SECRET.\n"
    );
  }

  console.log("\n2/7 Launch checklist …");
  run("npm run launch-checklist", true);

  console.log("\n3/7 Postgres schema + PostGIS …");
  if (!run("npm run setup:postgres")) process.exit(1);

  console.log("\n4/7 Redeploy Vercel …");
  if (!run("npx vercel --prod --yes")) process.exit(1);

  console.log("\n5/7 Wait for deployment (45s) …");
  await new Promise((r) => setTimeout(r, 45_000));

  console.log("\n6/7 Health check …");
  const health = await checkRemoteHealth();
  if (!health.ready) {
    console.warn("Health not ready yet — may need another minute. Continuing bootstrap …");
  }

  process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? APP_URL;
  console.log("\n7/7 Bootstrap datasets + verify …");
  if (!process.env.CRON_SECRET?.trim()) {
    console.warn("Skipping bootstrap (no local CRON_SECRET). Run after adding .env.production.secrets");
  } else if (!run("npm run bootstrap:prod")) process.exit(1);

  console.log("\n— GitHub secrets (optional) …");
  run(
    `gh secret set APP_URL --body "${APP_URL}" -R reda-baqechame/zonning`,
    true
  );
  if (process.env.CRON_SECRET) {
    run(
      `gh secret set CRON_SECRET --body "${process.env.CRON_SECRET}" -R reda-baqechame/zonning`,
      true
    );
  }

  console.log("\n" + "═".repeat(60));
  console.log("✓ AUTO-FINISH COMPLETE");
  console.log(`  App: ${APP_URL}`);
  console.log(`  Health: ${APP_URL}/api/health`);
  console.log("═".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
