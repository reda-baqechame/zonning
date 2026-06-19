/**
 * Production environment validation — called once at server startup.
 */

import {
  resolveDatabaseUrl,
  resolveUpstashRestToken,
  resolveUpstashRestUrl,
} from "./env-resolve";

export type EnvIssue = {
  key: string;
  message: string;
  severity: "error" | "warn" | "info";
};

export function getIntegrationStatus() {
  const has = (k: string) => Boolean(process.env[k]?.trim());
  const stripePartial =
    has("STRIPE_SECRET_KEY") ||
    has("STRIPE_WEBHOOK_SECRET") ||
    has("STRIPE_PRICE_ESSENTIEL");

  return {
    resend: has("RESEND_API_KEY"),
    stripe: has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET"),
    stripeDemo: !has("STRIPE_SECRET_KEY"),
    stripeMisconfigured: stripePartial && !has("STRIPE_SECRET_KEY"),
    upstash: Boolean(resolveUpstashRestUrl() && resolveUpstashRestToken()),
    twilio:
      has("TWILIO_ACCOUNT_SID") &&
      has("TWILIO_AUTH_TOKEN") &&
      has("TWILIO_FROM"),
    openai: has("OPENAI_API_KEY"),
    sentry: has("SENTRY_DSN"),
  };
}

export function collectEnvIssues(): EnvIssue[] {
  const issues: EnvIssue[] = [];
  const isProd = process.env.NODE_ENV === "production";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (isProd && !process.env.CRON_SECRET) {
    issues.push({
      key: "CRON_SECRET",
      message: "Required in production to protect cron/sync endpoints",
      severity: "error",
    });
  }

  if (isProd && !process.env.SESSION_SECRET) {
    issues.push({
      key: "SESSION_SECRET",
      message: "Required in production for signed session cookies",
      severity: "error",
    });
  }

  if (isProd && process.env.SESSION_SECRET === process.env.CRON_SECRET) {
    issues.push({
      key: "SESSION_SECRET",
      message: "Should differ from CRON_SECRET",
      severity: "warn",
    });
  }

  if (isProd && !resolveDatabaseUrl() && !process.env.SQLITE_DATABASE_URL) {
    issues.push({
      key: "DATABASE_URL",
      message: "Database URL required in production (DATABASE_URL or POSTGRES_PRISMA_URL)",
      severity: "error",
    });
  }

  if (isProd && (!appUrl || appUrl.includes("localhost"))) {
    issues.push({
      key: "NEXT_PUBLIC_APP_URL",
      message: "Must be set to your public https URL (not localhost)",
      severity: "error",
    });
  }

  if (isProd && !resolveUpstashRestUrl()) {
    issues.push({
      key: "UPSTASH_REDIS_REST_URL",
      message: "Required in production (UPSTASH_REDIS_REST_URL or KV_REST_API_URL from Vercel Upstash integration)",
      severity: "error",
    });
  }

  if (isProd && !resolveUpstashRestToken()) {
    issues.push({
      key: "UPSTASH_REDIS_REST_TOKEN",
      message: "Required pair (UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN)",
      severity: "error",
    });
  }

  if (isProd && !process.env.ADMIN_EMAILS) {
    issues.push({
      key: "ADMIN_EMAILS",
      message: "Required in production for admin dashboard and concierge",
      severity: "warn",
    });
  }

  if (isProd && !process.env.RESEND_API_KEY) {
    issues.push({
      key: "RESEND_API_KEY",
      message: "Required for email alerts and digests",
      severity: "warn",
    });
  }

  if (isProd) {
    if (!process.env.LEVIS_PERMITS_URL) {
      issues.push({
        key: "LEVIS_PERMITS_URL",
        message: "Recommended for permits-levis — dataset may stay empty until configured",
        severity: "warn",
      });
    }
    if (!process.env.BROSSARD_PROJECTS_URL) {
      issues.push({
        key: "BROSSARD_PROJECTS_URL",
        message: "Recommended for projects-brossard — dataset may stay empty until configured",
        severity: "warn",
      });
    }
    if (!process.env.GATINEAU_PERMITS_CKAN_ID && !process.env.GATINEAU_PERMITS_STATS_URL) {
      issues.push({
        key: "GATINEAU_PERMITS",
        message: "Set GATINEAU_PERMITS_CKAN_ID or GATINEAU_PERMITS_STATS_URL for Gatineau permits",
        severity: "warn",
      });
    }
    const scaffoldEnv: { key: string; label: string }[] = [
      { key: "SHERBROOKE_PERMITS_URL", label: "permits-sherbrooke" },
      { key: "V3R_PERMITS_URL", label: "permits-trois-rivieres" },
      { key: "SAGUENAY_PERMITS_URL", label: "permits-saguenay" },
      { key: "TERREBONNE_PERMITS_URL", label: "permits-terrebonne" },
      { key: "REPENTIGNY_PERMITS_URL", label: "permits-repentigny" },
      { key: "BROSSARD_PERMITS_URL", label: "permits-brossard" },
      { key: "SJR_PERMITS_URL", label: "permits-saint-jean-richelieu" },
      { key: "DRUMMONDVILLE_PERMITS_URL", label: "permits-drummondville" },
      { key: "SAINT_JEROME_PERMITS_URL", label: "permits-saint-jerome" },
      { key: "GRANBY_PERMITS_URL", label: "permits-granby" },
      { key: "SAINT_HYACINTHE_PERMITS_URL", label: "permits-saint-hyacinthe" },
      { key: "LONGUEUIL_PERMITS_URL", label: "permits-longueuil fallback" },
      { key: "SHERBROOKE_ZONING_URL", label: "zoning-sherbrooke" },
      { key: "QUEBEC_ZONING_URL", label: "zoning-quebec" },
      { key: "LAVAL_ZONING_URL", label: "zoning-laval" },
      { key: "LONGUEUIL_ZONING_URL", label: "zoning-longueuil" },
      { key: "AMP_REGISTRY_URL", label: "amp-registry" },
      { key: "RBQ_INFRACTIONS_URL", label: "rbq-infractions" },
      { key: "MTL_INSPECTIONS_URL", label: "inspection-violations-mtl" },
    ];
    for (const { key, label } of scaffoldEnv) {
      if (!process.env[key]) {
        issues.push({
          key,
          message: `Recommended for ${label} — may stay empty until configured`,
          severity: "info",
        });
      }
    }
  }

  const integrations = getIntegrationStatus();
  if (integrations.stripeMisconfigured) {
    issues.push({
      key: "STRIPE",
      message: "Partial Stripe config — set STRIPE_SECRET_KEY and all STRIPE_PRICE_* or remove partial keys",
      severity: "error",
    });
  }

  if (!integrations.stripe && !integrations.stripeMisconfigured) {
    issues.push({
      key: "STRIPE",
      message: "Not configured — demo billing active until keys added",
      severity: "info",
    });
  }

  if (!integrations.twilio) {
    issues.push({
      key: "TWILIO",
      message: "Not configured — SMS alerts disabled",
      severity: "info",
    });
  }

  if (!integrations.openai) {
    issues.push({
      key: "OPENAI_API_KEY",
      message: "Not configured — using fallback summaries",
      severity: "info",
    });
  }

  if (!integrations.sentry) {
    issues.push({
      key: "SENTRY_DSN",
      message: "Not configured — error monitoring disabled",
      severity: "info",
    });
  }

  if (process.env.SYNC_ENABLED === "false") {
    issues.push({
      key: "SYNC_ENABLED",
      message: "Dataset auto-sync is disabled",
      severity: "warn",
    });
  }

  return issues;
}

const SECURITY_ERROR_KEYS = new Set([
  "CRON_SECRET",
  "SESSION_SECRET",
  "STRIPE",
]);

/** Keys that must be set before the app is fully operational. */
export function getMissingRequiredEnv(): string[] {
  return collectEnvIssues()
    .filter((i) => i.severity === "error")
    .map((i) => i.key);
}

export function validateProductionEnv(): void {
  const issues = collectEnvIssues().filter((i) => i.severity === "error");
  if (issues.length === 0) return;

  const security = issues.filter((i) => SECURITY_ERROR_KEYS.has(i.key));
  const infra = issues.filter((i) => !SECURITY_ERROR_KEYS.has(i.key));

  const msg = issues.map((i) => `${i.key}: ${i.message}`).join("; ");

  if (process.env.NODE_ENV === "production") {
    if (security.length > 0) {
      throw new Error(`ZONNING production env invalid — ${security.map((i) => `${i.key}: ${i.message}`).join("; ")}`);
    }
    if (infra.length > 0) {
      console.error(`[env] Production infra incomplete — ${msg}. Fix via Vercel env vars. /api/health shows status.`);
    }
    return;
  }
  console.warn(`[env] ${msg}`);
}

export function isSyncAutomationEnabled(): boolean {
  return process.env.SYNC_ENABLED !== "false";
}

/** True when Stripe is absent and demo plan upgrades are allowed. */
export function isStripeDemoMode(): boolean {
  const integrations = getIntegrationStatus();
  if (integrations.stripeMisconfigured) return false;
  if (!integrations.stripeDemo) return false;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_STRIPE_DEMO !== "true") {
    return false;
  }
  return true;
}
