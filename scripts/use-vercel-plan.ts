import { copyFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const plan = (process.argv[2] ?? "hobby").toLowerCase();
const root = process.cwd();
const dest = join(root, "vercel.json");

if (plan === "none") {
  writeFileSync(
    dest,
    `${JSON.stringify(
      {
        buildCommand: "npm run vercel-build",
        installCommand: "npm install",
        framework: "nextjs",
        crons: [],
      },
      null,
      2
    )}\n`
  );
  console.log("✓ vercel.json → no Vercel crons (GitHub Actions only)");
  process.exit(0);
}

const src = join(root, plan === "pro" ? "vercel.pro.json" : "vercel.hobby.json");
if (!existsSync(src)) {
  console.error(`Missing ${src}`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`✓ vercel.json ← ${plan === "pro" ? "vercel.pro.json (5-min crons, Pro plan)" : "vercel.hobby.json (daily crons)"}`);
