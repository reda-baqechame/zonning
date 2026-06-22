import { afterEach, describe, expect, it } from "vitest";
import { resolvePgPoolMax } from "@/lib/env-resolve";

describe("resolvePgPoolMax", () => {
  const env = process.env;

  afterEach(() => {
    process.env = env;
  });

  it("uses a small pool per Vercel instance by default", () => {
    process.env = { ...env, VERCEL: "1" };
    delete process.env.PG_POOL_MAX;

    expect(resolvePgPoolMax()).toBe(1);
  });

  it("honours a bounded explicit override", () => {
    process.env = { ...env, VERCEL: "1", PG_POOL_MAX: "4" };

    expect(resolvePgPoolMax()).toBe(4);
  });

  it("rejects unsafe or malformed overrides", () => {
    process.env = { ...env, VERCEL: "1", PG_POOL_MAX: "100" };
    expect(resolvePgPoolMax()).toBe(1);

    process.env.PG_POOL_MAX = "not-a-number";
    expect(resolvePgPoolMax()).toBe(1);
  });
});
