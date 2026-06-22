import "dotenv/config";
import { loadProdEnv } from "./load-prod-env";
import { collectEnvIssues } from "../src/lib/env";
import {
  resolveDatabaseUrl,
  resolveUpstashRestToken,
  resolveUpstashRestUrl,
} from "../src/lib/env-resolve";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
  required: boolean;
};

function has(v?: string) {
  return Boolean(v && v.trim().length > 0);
}

function main() {
  loadProdEnv();
  console.log("ZONNING launch checklist\n");

  const url = resolveDatabaseUrl() ?? "";
  const isPostgres = url.startsWith("postgres");

  const checks: Check[] = [
    {
      name: "DATABASE_URL",
      ok: has(url),
      detail: isPostgres ? "Postgres" : url.startsWith("file:") ? "SQLite (dev)" : "missing",
      required: true,
    },
    {
      name: "CRON_SECRET",
      ok: has(process.env.CRON_SECRET) && (process.env.CRON_SECRET?.length ?? 0) >= 16,
      detail: process.env.CRON_SECRET ? "set" : "missing",
      required: true,
    },
    {
      name: "SESSION_SECRET",
      ok:
        has(process.env.SESSION_SECRET) &&
        process.env.SESSION_SECRET !== process.env.CRON_SECRET,
      detail: process.env.SESSION_SECRET ? "set" : "missing",
      required: true,
    },
    {
      name: "NEXT_PUBLIC_APP_URL",
      ok:
        has(process.env.NEXT_PUBLIC_APP_URL) &&
        !process.env.NEXT_PUBLIC_APP_URL?.includes("localhost"),
      detail: process.env.NEXT_PUBLIC_APP_URL ?? "missing",
      required: true,
    },
    {
      name: "ADMIN_EMAILS",
      ok: has(process.env.ADMIN_EMAILS),
      detail: process.env.ADMIN_EMAILS ?? "missing",
      required: true,
    },
    {
      name: "SYNC_ENABLED",
      ok: process.env.SYNC_ENABLED !== "false",
      detail: process.env.SYNC_ENABLED ?? "true (default)",
      required: true,
    },
    {
      name: "RESEND_API_KEY",
      ok: has(process.env.RESEND_API_KEY),
      detail: has(process.env.RESEND_API_KEY) ? "set" : "missing — email disabled",
      required: true,
    },
    {
      name: "EMAIL_FROM",
      ok: has(process.env.EMAIL_FROM),
      detail: process.env.EMAIL_FROM ?? "missing — set ZONNING <onboarding@resend.dev>",
      required: true,
    },
    {
      name: "UPSTASH_REDIS",
      ok: Boolean(resolveUpstashRestUrl() && resolveUpstashRestToken()),
      detail: "distributed rate limits",
      required: true,
    },
    {
      name: "STRIPE_SECRET_KEY",
      ok: has(process.env.STRIPE_SECRET_KEY),
      detail: has(process.env.STRIPE_SECRET_KEY) ? "live billing" : "billing disabled",
      required: false,
    },
    {
      name: "TWILIO",
      ok: has(process.env.TWILIO_ACCOUNT_SID) && has(process.env.TWILIO_AUTH_TOKEN),
      detail: has(process.env.TWILIO_ACCOUNT_SID) ? "SMS enabled" : "email only",
      required: false,
    },
    {
      name: "OPENAI_API_KEY",
      ok: has(process.env.OPENAI_API_KEY),
      detail: has(process.env.OPENAI_API_KEY) ? "AI summaries" : "fallback text",
      required: false,
    },
    {
      name: "SENTRY_DSN",
      ok: has(process.env.SENTRY_DSN),
      detail: has(process.env.SENTRY_DSN) ? "monitoring" : "optional",
      required: false,
    },
  ];

  for (const c of checks) {
    const mark = c.ok ? "✓" : c.required ? "✗" : "○";
    console.log(`${mark} ${c.name}: ${c.detail}`);
  }

  const envIssues = collectEnvIssues();
  const errors = envIssues.filter((i) => i.severity === "error");
  const warns = envIssues.filter((i) => i.severity === "warn");

  if (warns.length > 0) {
    console.log("\nWarnings:");
    for (const w of warns) console.log(`  - ${w.key}: ${w.message}`);
  }

  const requiredFailed = checks.filter((c) => c.required && !c.ok).length;
  console.log(`\n${requiredFailed === 0 && errors.length === 0 ? "Ready for deploy" : "Fix required items before production"}`);

  if (requiredFailed > 0 || errors.length > 0) process.exit(1);
}

main();
