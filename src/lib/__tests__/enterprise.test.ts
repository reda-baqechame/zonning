import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { collectEnvIssues, isSyncAutomationEnabled, isStripeDemoMode } from "@/lib/env";
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

describe("isStripeDemoMode", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("blocks demo upgrades in production without ALLOW_STRIPE_DEMO", () => {
    process.env = { ...env, NODE_ENV: "production" };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.ALLOW_STRIPE_DEMO;
    expect(isStripeDemoMode()).toBe(false);
  });

  it("allows demo in production when explicitly enabled", () => {
    process.env = { ...env, NODE_ENV: "production", ALLOW_STRIPE_DEMO: "true" };
    delete process.env.STRIPE_SECRET_KEY;
    expect(isStripeDemoMode()).toBe(true);
  });
});

describe("admin emails", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("uses demo only in non-production when unset", () => {
    process.env = { ...env, NODE_ENV: "development" };
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual(["demo@zonning.ca"]);
    expect(isAdminEmail("demo@zonning.ca")).toBe(true);
  });

  it("returns empty in production when unset", () => {
    process.env = { ...env, NODE_ENV: "production" };
    delete process.env.ADMIN_EMAILS;
    expect(getAdminEmails()).toEqual([]);
    expect(isAdminEmail("demo@zonning.ca")).toBe(false);
  });
});

describe("dataset count", () => {
  it("returns 52 active datasets without EXPAND_ONTARIO", async () => {
    const prev = process.env.EXPAND_ONTARIO;
    delete process.env.EXPAND_ONTARIO;
    const { getDatasetCount, getActiveDatasetIds } = await import("@/lib/datasets/registry");
    expect(getDatasetCount()).toBe(52);
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
