import "dotenv/config";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://zonning.vercel.app";

function run(cmd: string, optional = false) {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env, cwd: process.cwd() });
    return true;
  } catch {
    if (!optional) {
      console.error(`\n✗ Failed: ${cmd}`);
      process.exit(1);
    }
    console.warn(`\n⚠ Skipped (optional): ${cmd}`);
    return false;
  }
}

async function checkHealth(): Promise<{ ready: boolean; missing?: string[] }> {
  const res = await fetch(`${APP_URL}/api/health`);
  const json = (await res.json()) as { ready?: boolean; missing?: string[]; db?: boolean };
  console.log(JSON.stringify(json, null, 2));
  return { ready: Boolean(json.ready), missing: json.missing };
}

async function main() {
  console.log("ZONNING finish-deploy\n");
  console.log(`Target: ${APP_URL}\n`);

  const envFile = join(process.cwd(), ".env.production.local");
  if (existsSync(envFile)) {
    console.log("Loading .env.production.local …");
    for (const line of readFileSync(envFile, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }

  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    console.error(`
✗ DATABASE_URL (Postgres) is required.

Create Supabase → Settings → Database → Connection string (Pooler, port 6543, ?pgbouncer=true)
Save to Vercel env + .env.production.local, then re-run:

  npm run finish-deploy
`);
    process.exit(1);
  }

  run("npm run launch-checklist", true);

  console.log("\n— Postgres schema + PostGIS …");
  run("npm run setup:postgres");

  console.log("\n— Vercel production deploy …");
  run("npx vercel --prod --yes", true);

  console.log("\n— Waiting 30s for deployment …");
  await new Promise((r) => setTimeout(r, 30_000));

  const health = await checkHealth();
  if (!health.ready && health.missing?.length) {
    console.warn(`\n⚠ Still missing in Vercel: ${health.missing.join(", ")}`);
    console.warn("Add them at https://vercel.com → Project → Settings → Environment Variables");
    console.warn("Then: npx vercel --prod --yes && npm run finish-deploy\n");
    process.exit(1);
  }

  console.log("\n— Bootstrap datasets …");
  process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  run("npm run bootstrap:prod");

  console.log("\n— Post-deploy verification …");
  run("npm run verify:deploy", true);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
