import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { collectEnvIssues, getIntegrationStatus, isSyncAutomationEnabled } from "@/lib/env";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";

describe("collectEnvIssues", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env, NODE_ENV: "production" };
  });

  afterEach(() => {
    process.env = env;
  });

  it("flags missing CRON_SECRET and SESSION_SECRET in production", () => {
    delete process.env.CRON_SECRET;
    delete process.env.SESSION_SECRET;
    process.env.NEXT_PUBLIC_APP_URL = "https://app.zonning.ca";
    const errors = collectEnvIssues().filter((i) => i.severity === "error");
    expect(errors.map((e) => e.key)).toContain("CRON_SECRET");
    expect(errors.map((e) => e.key)).toContain("SESSION_SECRET");
  });

  it("requires Upstash in production", () => {
    process.env.CRON_SECRET = "a";
    process.env.SESSION_SECRET = "b";
    process.env.DATABASE_URL = "postgres://x";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.zonning.ca";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const errors = collectEnvIssues().filter((i) => i.severity === "error");
    expect(errors.map((e) => e.key)).toContain("UPSTASH_REDIS_REST_URL");
    expect(errors.map((e) => e.key)).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("getMissingRequiredEnv lists infra gaps", async () => {
    process.env = { ...env, NODE_ENV: "production" };
    delete process.env.DATABASE_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { getMissingRequiredEnv } = await import("@/lib/env");
    const missing = getMissingRequiredEnv();
    expect(missing).toContain("DATABASE_URL");
    expect(missing).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("warns when SYNC_ENABLED is false", () => {
    process.env.CRON_SECRET = "a";
    process.env.SESSION_SECRET = "b";
    process.env.DATABASE_URL = "postgres://x";
    process.env.SYNC_ENABLED = "false";
    const warns = collectEnvIssues().filter((i) => i.key === "SYNC_ENABLED");
    expect(warns).toHaveLength(1);
  });
});

describe("isSyncAutomationEnabled", () => {
  it("defaults to enabled", () => {
    delete process.env.SYNC_ENABLED;
    expect(isSyncAutomationEnabled()).toBe(true);
  });

  it("respects SYNC_ENABLED=false", () => {
    process.env.SYNC_ENABLED = "false";
    expect(isSyncAutomationEnabled()).toBe(false);
  });
});

describe("Stripe integration status", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("reports billing as disabled when Stripe is absent", () => {
    process.env = { ...env, NODE_ENV: "production" };
    delete process.env.STRIPE_SECRET_KEY;
    expect(getIntegrationStatus().stripe).toBe(false);
    expect(getIntegrationStatus().stripeDisabled).toBe(true);
  });
});

describe("admin emails", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("uses demo only in non-production when unset", () => {
    process.env = { ...env, NODE_ENV: "development", ZONNING_FREE_TEST_MODE: "false" };
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual(["demo@zonning.ca"]);
    expect(isAdminEmail("demo@zonning.ca")).toBe(true);
  });

  it("opens admin checks while free test mode is active", () => {
    process.env = { ...env, NODE_ENV: "production" };
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
    expect(isAdminEmail("team@zonning.ca")).toBe(true);
  });

  it("returns empty in production when unset", () => {
    process.env = { ...env, NODE_ENV: "production", ZONNING_FREE_TEST_MODE: "false" };
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
    expect(isAdminEmail("demo@zonning.ca")).toBe(false);
  });
});

describe("dataset count", () => {
  it("separates runnable indexed datasets from registered coverage sources", async () => {
    const prev = process.env.EXPAND_ONTARIO;
    delete process.env.EXPAND_ONTARIO;
    const {
      getDatasetCount,
      getActiveDatasetIds,
      getRegisteredSourceCount,
      DATASETS,
    } = await import("@/lib/datasets/registry");
    expect(getDatasetCount()).toBeLessThan(getRegisteredSourceCount());
    expect(getActiveDatasetIds()).not.toContain("permits-trois-rivieres");
    expect(DATASETS["permits-trois-rivieres"].coverageStatus).toBe("document_only");
    expect(getActiveDatasetIds()).not.toContain("zoning");
    expect(getActiveDatasetIds()).not.toContain("toronto-permits");
    process.env.EXPAND_ONTARIO = prev;
  });
});

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retries on 503 then succeeds", async () => {
    const { fetchWithRetry } = await import("@/lib/http/resilience");
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls < 2) {
        return new Response("busy", { status: 503 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));

    const res = await fetchWithRetry("https://example.com/data", undefined, {
      retries: 2,
      baseDelayMs: 1,
    });
    expect(res.ok).toBe(true);
    expect(calls).toBe(2);
  });
});
