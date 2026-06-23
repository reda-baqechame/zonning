import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

describe("pasted audit contracts", () => {
  it("keeps /feed protected and /feed-preview public", () => {
    const feedPage = read("src/app/[locale]/feed/page.tsx");
    const previewPage = read("src/app/[locale]/feed-preview/page.tsx");
    const nav = read("src/components/NavBar.tsx");

    expect(feedPage).toContain("requireOnboardingComplete");
    expect(previewPage).not.toContain("requireOnboardingComplete");
    expect(nav).toContain('user ? "/feed" : "/feed-preview"');
  });

  it("renders ChantierRadar funnel diagnostics and zero reasons", () => {
    const client = read("src/app/[locale]/chantier-radar/ChantierRadarClient.tsx");
    const permitsRoute = read("src/app/api/permits/route.ts");

    for (const token of [
      "rawIndexed",
      "afterDateFilter",
      "afterFilters",
      "mappable",
      "lastSyncAt",
      "zeroReason",
    ]) {
      expect(client).toContain(token);
      expect(permitsRoute).toContain(token);
    }
  });

  it("keeps public health minimal and detailed health authorized", () => {
    const health = read("src/app/api/health/route.ts");
    const publicBlock = health.slice(
      health.indexOf("if (!authorized)"),
      health.indexOf("const integrations"),
    );
    const authorizedBlock = health.slice(health.indexOf("const integrations"));

    expect(publicBlock).toContain("ok: ready");
    expect(publicBlock).toContain("checkedAt");
    expect(publicBlock).not.toContain("missing:");
    expect(publicBlock).not.toContain("dbError:");
    expect(authorizedBlock).toContain("missing:");
    expect(authorizedBlock).toContain("envWarnings");
  });

  it("keeps live runtime truth out of the global footer", () => {
    const runtimeTruth = read("src/lib/runtime-truth.ts");
    const publicRoute = read("src/app/api/public/runtime-summary/route.ts");
    const footer = read("src/components/SiteFooter.tsx");

    expect(runtimeTruth).toContain("searchableMunicipalities");
    expect(publicRoute).toContain("buildPublicRuntimeSummary");
    expect(footer).not.toContain("buildPublicRuntimeSummary");
    expect(footer).not.toContain("@/lib/runtime-truth");
    expect(footer).not.toContain("@/lib/prisma");
    expect(footer).toContain("trustTruth");
  });

  it("has a dedicated map route and English map alias", () => {
    expect(existsSync(path.join(root, "src/app/[locale]/carte/page.tsx"))).toBe(true);
    expect(existsSync(path.join(root, "src/app/[locale]/map/page.tsx"))).toBe(true);
    expect(read("src/app/[locale]/map/page.tsx")).toContain('href: "/carte"');
  });

  it("models parcel-aware zoning without labelling point fallback as confirmed", () => {
    const schema = read("prisma/schema.prisma");
    const lookup = read("src/lib/zoning/lookup.ts");

    expect(schema).toContain("model ZoningPolygon");
    expect(schema).toContain("model ParcelPoint");
    expect(schema).toContain("model AddressGeocode");
    expect(schema).toContain("model ZoningRegulationLink");
    expect(lookup).toContain('determination: "confirmed"');
    expect(lookup).toContain('determination: "nearest_fallback"');
    expect(lookup.indexOf('determination: "confirmed"')).toBeLessThan(
      lookup.indexOf('determination: "nearest_fallback"'),
    );
  });

  it("keeps user-facing API routes read-only for sync", () => {
    const apiRoot = path.join(root, "src/app/api");
    const boundary = read("src/lib/__tests__/api-route-sync-boundary.test.ts");
    expect(boundary).toContain("ensureFreshForKey");
    expect(boundary).toContain("ensureQuebecRealtimeFresh");
    expect(apiRoot).toContain(path.join("src", "app", "api"));
  });
});
