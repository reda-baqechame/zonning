import { afterEach, describe, expect, it } from "vitest";
import {
  politeWait,
  recordOutcome,
  resetPolitenessForTests,
  POLITENESS_MIN_INTERVAL_MS,
} from "@/lib/http/politeness";

const HOST = "https://donneesquebec.ca/api/x";

afterEach(() => {
  resetPolitenessForTests();
});

describe("politeness gate", () => {
  it("does not wait on the first request to a host", async () => {
    const start = Date.now();
    await politeWait(HOST, 1000);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("waits the min interval between requests to the same host", async () => {
    await politeWait(HOST, 300);
    const start = Date.now();
    await politeWait(HOST, 300);
    const elapsed = Date.now() - start;
    // Should have waited ~300ms (allow a little slack).
    expect(elapsed).toBeGreaterThanOrEqual(250);
    expect(elapsed).toBeLessThan(600);
  });

  it("treats different hosts independently", async () => {
    await politeWait("https://host-a.ca/x", 300);
    const start = Date.now();
    await politeWait("https://host-b.ca/y", 300);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("opens the circuit after repeated failures", async () => {
    for (let i = 0; i < 5; i++) recordOutcome(HOST, false);
    await expect(politeWait(HOST)).rejects.toThrow(/circuit open/i);
  });

  it("resets failures after a success", async () => {
    for (let i = 0; i < 4; i++) recordOutcome(HOST, false);
    recordOutcome(HOST, true);
    await expect(politeWait(HOST)).resolves.toBeUndefined();
  });

  it("exposes a sane default interval", () => {
    expect(POLITENESS_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });
});
