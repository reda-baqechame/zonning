import { describe, expect, it } from "vitest";
import { evaluateQuality } from "../quality-rules";

describe("evaluateQuality", () => {
  it("flags zero rows after prior success as anomaly", () => {
    const result = evaluateQuality({
      datasetId: "permits",
      rowsIngested: 0,
      hadPriorSuccess: true,
      syncOk: true,
      source: "empty",
    });
    expect(result.status).toBe("anomaly");
  });

  it("passes skipped syncs", () => {
    const result = evaluateQuality({
      datasetId: "permits",
      rowsIngested: 0,
      hadPriorSuccess: true,
      syncOk: true,
      source: "skipped",
    });
    expect(result.status).toBe("ok");
  });

  it("warns on low full sync row count even after prior success", () => {
    const result = evaluateQuality({
      datasetId: "permits",
      rowsIngested: 200,
      hadPriorSuccess: true,
      syncOk: true,
      source: "live",
      isIncrementalSync: false,
    });
    expect(result.status).toBe("warn");
  });

  it("flags large drop vs median", () => {
    const result = evaluateQuality({
      datasetId: "permits",
      rowsIngested: 50,
      hadPriorSuccess: true,
      priorMedianIngested: 200,
      syncOk: true,
      source: "live",
      isIncrementalSync: true,
    });
    expect(result.status).toBe("anomaly");
  });

  it("allows empty for bootstrap allowlist datasets", () => {
    const result = evaluateQuality({
      datasetId: "permits-gatineau",
      rowsIngested: 0,
      hadPriorSuccess: true,
      syncOk: true,
      source: "empty",
    });
    expect(result.status).toBe("ok");
  });
});
