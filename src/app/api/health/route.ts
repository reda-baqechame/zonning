import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  collectEnvIssues,
  getIntegrationStatus,
  getMissingRequiredEnv,
  isSyncAutomationEnabled,
} from "@/lib/env";
import { emailFromDomain } from "@/lib/email/templates";
import { getDatasetCount, getBootstrapAllowlist } from "@/lib/datasets/registry";
import { isSyncAuthorized } from "@/lib/sync/auth";
import { enforceRateLimit, jsonWithRequestId } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:health", 60, 60_000);
  if (limited) return limited;

  const started = Date.now();
  let dbOk = false;
  let dbError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbOk = false;
    dbError = e instanceof Error ? e.message.slice(0, 120) : "Database unavailable";
  }

  const authorized = isSyncAuthorized(req);
  const envIssues = collectEnvIssues();
  const errors = envIssues.filter((i) => i.severity === "error");
  const missing = getMissingRequiredEnv();
  const ready = dbOk && errors.length === 0;

  if (!authorized) {
    // Public health is intentionally minimal: readiness + DB liveness only.
    // Missing env var names, dbError detail, and version are infra signals we
    // do not hand to unauthenticated callers (avoids a vuln/config checklist).
    return jsonWithRequestId(
      req,
      {
        ok: ready,
        ready,
        db: dbOk,
        checkedAt: new Date().toISOString(),
      },
      { status: ready ? 200 : 503 }
    );
  }

  const integrations = getIntegrationStatus();

  return jsonWithRequestId(
    req,
    {
      ok: ready,
      ready,
      db: dbOk,
      missing: missing.length > 0 ? missing : undefined,
      dbError: !dbOk ? dbError : undefined,
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      syncAutomation: isSyncAutomationEnabled(),
      integrations: {
        resend: integrations.resend,
        resendConfigured: integrations.resend && Boolean(process.env.EMAIL_FROM?.trim()),
        emailFromDomain: emailFromDomain(),
        stripe: integrations.stripe,
        stripeDisabled: integrations.stripeDisabled,
        upstash: integrations.upstash,
        twilio: integrations.twilio,
        openai: integrations.openai,
        sentry: integrations.sentry,
      },
      datasets: {
        active: getDatasetCount(),
        bootstrapAllowlist: getBootstrapAllowlist().length,
      },
      envWarnings: envIssues.filter((i) => i.severity === "warn").map((i) => i.key),
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 }
  );
}
