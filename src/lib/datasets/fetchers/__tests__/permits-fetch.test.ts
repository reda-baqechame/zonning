import { describe, expect, it, vi, beforeEach } from "vitest";

const { fixtureCsv } = vi.hoisted(() => ({
  fixtureCsv: `no_demande,emplacement,arrondissement,date_emission,cout_estime,description_type_demande
P1,100 Rue A,Ville-Marie,2024-06-15,100000,Construction
P2,200 Rue B,Plateau,2024-05-10,200000,Construction
P3,300 Rue C,Rosemont,2024-04-01,150000,Construction
P4,400 Rue D,Ville-Marie,2023-12-01,90000,Construction
P5,500 Rue E,Verdun,2023-08-15,80000,Construction
`,
}));

vi.mock("../../client", () => ({
  fetchCkanResourceUrl: vi.fn().mockResolvedValue("https://example.com/permits.csv"),
  fetchText: vi.fn().mockResolvedValue(fixtureCsv),
  // No DataStore available in this CSV-path test → falls back to fetchText.
  fetchCkanPackage: vi.fn().mockResolvedValue(null),
  fetchCkanDatastoreSearch: vi.fn().mockResolvedValue([]),
}));

import { fetchPermits, fetchPermitsPaginated } from "../permits";

describe("fetchPermitsPaginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed permits from mocked CKAN CSV", async () => {
    const results = await fetchPermits(10, { maxAgeDays: 3650 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.city).toBe("Montréal");
    expect(results[0]?.externalId).toBe("P1");
  });

  it("respects maxIssueDate window filtering", async () => {
    const all = await fetchPermits(10, { maxAgeDays: 3650 });
    const oldest = all[all.length - 1]?.issueDate;
    expect(oldest).toBeDefined();

    const older = await fetchPermits(10, {
      maxAgeDays: 3650,
      maxIssueDate: oldest,
    });
    for (const p of older) {
      if (p.issueDate && oldest) {
        expect(p.issueDate.getTime()).toBeLessThan(oldest.getTime());
      }
    }
  });

  it("paginates without minIssueDate cursor", async () => {
    const results = await fetchPermitsPaginated(5, { maxAgeDays: 3650 });
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results.length).toBeGreaterThan(0);
  });
});
