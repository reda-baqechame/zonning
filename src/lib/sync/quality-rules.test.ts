import { describe, expect, it } from "vitest";
import { evaluateQuality } from "./quality-rules";

describe("dataset sync quality semantics", () => {
  it("accepts a cursor sync that proves the source is unchanged", () => {
    expect(
      evaluateQuality({
        datasetId: "permits",
        rowsIngested: 0,
        hadPriorSuccess: true,
        syncOk: true,
        source: "unchanged",
        isIncrementalSync: true,
      }),
    ).toEqual({ status: "ok" });
  });

  it("flags an empty full permit import after prior success", () => {
    expect(
      evaluateQuality({
        datasetId: "permits",
        rowsIngested: 0,
        hadPriorSuccess: true,
        syncOk: true,
        source: "empty",
        isIncrementalSync: false,
      }).status,
    ).toBe("anomaly");
  });

  it("does not confuse an incremental empty result with a source outage", () => {
    expect(
      evaluateQuality({
        datasetId: "permits",
        rowsIngested: 0,
        hadPriorSuccess: true,
        syncOk: true,
        source: "empty",
        isIncrementalSync: true,
      }).status,
    ).toBe("ok");
  });
});
