import { describe, expect, it } from "vitest";
import {
  ALL_DATASET_IDS,
  DATASETS,
  getRegisteredDatasetIds,
  getSyncEnabledDatasetIds,
  isDatasetSyncEnabled,
} from "@/lib/datasets/registry";

describe("dataset registry production policy", () => {
  it("never syncs document-only, licensed-required, or unavailable sources", () => {
    for (const id of ALL_DATASET_IDS) {
      const status = DATASETS[id].coverageStatus;
      if (
        status === "document_only" ||
        status === "licensed_required" ||
        status === "unavailable"
      ) {
        expect(isDatasetSyncEnabled(id), `${id} must not be sync-enabled`).toBe(false);
      }
    }
  });

  it("keeps registered source count separate from indexed live coverage", () => {
    const registered = getRegisteredDatasetIds();
    const syncEnabled = getSyncEnabledDatasetIds();

    expect(registered.length).toBeGreaterThan(syncEnabled.length);
    expect(syncEnabled.every((id) => registered.includes(id))).toBe(true);
  });

  it("requires every non-live foundation source to explain its limitation", () => {
    for (const id of getRegisteredDatasetIds()) {
      if (!isDatasetSyncEnabled(id)) {
        expect(DATASETS[id].coverageNote, `${id} needs a coverageNote`).toBeTruthy();
      }
    }
  });
});
