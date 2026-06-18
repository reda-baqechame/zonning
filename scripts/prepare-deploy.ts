import { execSync } from "child_process";
import { randomBytes } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

function run(label: string, cmd: string) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, env: process.env });
}

function section(title: string) {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

function main() {
  section("ZONNING deploy preparation");

  section("1/4 — CI (lint, typecheck, test, build)");
  run("CI", "npm run ci");

  section("2/4 — Production env template");
  const examplePath = join(ROOT, ".env.production.example");
  if (existsSync(examplePath)) {
    console.log(readFileSync(examplePath, "utf8"));
  }

  const cron = randomBytes(32).toString("hex");
  const session = randomBytes(32).toString("hex");
  console.log("\n--- Generated secrets (paste into Vercel) ---");
  console.log(`CRON_SECRET=${cron}`);
  console.log(`SESSION_SECRET=${session}`);

  section("3/4 — Local prod env check (optional)");
  if (process.env.SKIP_LAUNCH_CHECKLIST !== "1") {
    try {
      run("launch-checklist", "npm run launch-checklist");
    } catch {
      console.log(
        "\n⚠ launch-checklist failed — expected until you paste Vercel env vars.\n" +
          "   Re-run after setting NEXT_PUBLIC_APP_URL, DATABASE_URL, Upstash, etc."
      );
    }
  }

  section("4/4 — Deploy commands (run after Vercel login)");
  console.log(`
1. vercel login
2. vercel link
3. Paste env vars in Vercel dashboard (see .env.production.example + secrets above)
4. vercel --prod
5. Set NEXT_PUBLIC_APP_URL to your *.vercel.app URL → redeploy if needed
6. DATABASE_URL=postgresql://... npm run setup:postgres
7. NEXT_PUBLIC_APP_URL=https://YOUR-APP.vercel.app CRON_SECRET=... npm run bootstrap:prod
8. GitHub Secrets: APP_URL + CRON_SECRET
9. npm run verify:deploy  → expect 12/12

Full guide: LAUNCH.md
`);
  console.log("✓ Code is ready for deployment.\n");
}

main();
