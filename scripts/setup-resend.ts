/**
 * Add Resend credentials to Vercel Production and patch local .env.production.secrets.
 * Usage: RESEND_API_KEY=re_xxx npm run setup:resend
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const key = process.env.RESEND_API_KEY?.trim();
const from = process.env.EMAIL_FROM?.trim() ?? "ZONNING <onboarding@resend.dev>";

if (!key?.startsWith("re_")) {
  console.error(`
✗ RESEND_API_KEY required (starts with re_)

1. Create key: https://resend.com/api-keys
2. Run: RESEND_API_KEY=re_xxx npm run setup:resend
`);
  process.exit(1);
}

console.log("Adding Resend env to Vercel Production…");
execSync(`npx vercel env add RESEND_API_KEY production --force`, {
  cwd: ROOT,
  stdio: ["pipe", "inherit", "inherit"],
  input: key,
});

execSync(`npx vercel env add EMAIL_FROM production --force`, {
  cwd: ROOT,
  stdio: ["pipe", "inherit", "inherit"],
  input: from,
});

const localSecrets = join(ROOT, ".env.production.secrets");
const lines = new Map<string, string>();

if (existsSync(localSecrets)) {
  for (const line of readFileSync(localSecrets, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (v) lines.set(k, v);
  }
}

lines.set("RESEND_API_KEY", key);
lines.set("EMAIL_FROM", from);

const out = [
  "# local only — not committed",
  ...[...lines.entries()].map(([k, v]) => `${k}=${v}`),
  "",
].join("\n");

writeFileSync(localSecrets, out, "utf8");
console.log("✓ Updated .env.production.secrets (preserved existing keys)");
console.log("Run: npx vercel env pull .env.production.local --environment=production");
console.log("Then: npm run launch-checklist");
