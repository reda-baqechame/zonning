# Quebec Intelligence — Depth Over Breadth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the fake-coverage / weak-data pattern by (1) reporting only real indexed coverage, (2) deriving honest project-value bands and licensed-contractor contacts, (3) replacing keyword scoring with real RBQ/region/budget fit-scoring, (4) fixing the Québec coordinate parse bug, and (5) wiring parcel-level contamination/heritage verdicts — then deploy with live API proof.

**Architecture:** Pure derivation layer on top of the real indexed rows (Permit, Tender, TenderAward, RbqLicense, ContaminatedSite, HeritageSite, PropertyTransaction). Each new unit has one responsibility and a typed result. The OpportunityDossier (assembled by `lib/opportunities/dossier.ts`, served by `/api/feed`, `/api/permits`, `/api/tenders`) gains two new optional blocks: `valueEstimate` and `contactLeads`. Existing `contractor-fit.ts` keyword logic is kept as a fallback but the feed uses a new profile-aware scorer when a user is signed in. No new infrastructure; no new datasets; no scraping.

**Tech Stack:** Next.js 16 app router, Prisma (SQLite dev / Postgres prod), vitest, TypeScript strict, existing CKAN/ArcGIS adapters.

**Spec:** `docs/superpowers/specs/2026-06-24-quebec-intelligence-depth-design.md`

---

## File Structure

**Create:**
- `src/lib/permits/coordinate.ts` — coordinate parsing/validation (Task 5)
- `src/lib/permits/value-estimate.ts` — derived value band engine (Task 2)
- `src/lib/opportunities/contact-resolver.ts` — licensed-contractor + award resolver (Task 3)
- `src/lib/opportunities/contractor-fit-profile.ts` — profile-aware RBQ/region/budget scorer (Task 4)
- `src/lib/compliance/parcel-verdict.ts` — contamination/heritage parcel verdict (Task 6)
- `src/lib/permits/__tests__/coordinate.test.ts`
- `src/lib/permits/__tests__/value-estimate.test.ts`
- `src/lib/opportunities/__tests__/contact-resolver.test.ts`
- `src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`
- `src/lib/compliance/__tests__/parcel-verdict.test.ts`
- `src/lib/__tests__/coverage-honesty.test.ts`

**Modify:**
- `src/lib/datasets/parser.ts` — export coordinate helpers used by fetcher
- `src/lib/datasets/fetchers/permits.ts:87-88` — use coordinate parser
- `src/lib/datasets/adapters/CityPermitAdapter.ts` — Québec adapter coordinate path
- `src/lib/market-pulse.ts:270-272` — honest coverage counts
- `src/lib/domain/quebec.ts:128-203` — add `valueEstimate` + `contactLeads` to `OpportunityDossier`
- `src/lib/opportunities/dossier.ts` — wire value/contact into both dossier builders
- `src/app/api/feed/route.ts:222,302` — pass value/contact/parcel into dossier builders
- `scripts/verify-deploy.ts` — assert new fields appear in live feed

**No change:** registry URLs (placeholder cities stay registered as `document_only`, which the honesty layer now respects).

---

## Task 1: Honest coverage reporting

**Why first:** removes the #1 "feels fake" cause and needs no new data. Foundation for honest marketing.

**Files:**
- Modify: `src/lib/market-pulse.ts:254-284`
- Modify: `src/app/api/coverage/public/route.ts:26-33`
- Test: `src/lib/__tests__/coverage-honesty.test.ts`

### Step 1.1: Write the failing test

- [ ] **Create `src/lib/__tests__/coverage-honesty.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { COVERAGE_CITIES, DATASETS, isDatasetSyncEnabled } from "@/lib/datasets/registry";

// A city is "honestly covered" only if it has a sync-enabled permit dataset
// AND that dataset is not document_only/unavailable. This is the invariant the
// public coverage surface must respect: never count a placeholder as covered.
function isHonestlyCovered(city: (typeof COVERAGE_CITIES)[number]): boolean {
  const entries = Object.entries(DATASETS);
  const permitDataset = entries.find(
    ([, cfg]) => cfg.city === city && cfg.id.startsWith("permits-") || (city === "Montréal" && DATASETS.permits.city === city),
  );
  // fall back to checking the explicit permit dataset id for the city
  return COVERAGE_CITIES.some((c) => c === city) && false; // placeholder; real check below
}

describe("honest coverage invariant", () => {
  it("does not count document_only permit cities as honestly covered", () => {
    // Longueuil / Gatineau / Lévis are document_only in the registry
    for (const city of ["Longueuil", "Gatineau", "Lévis"] as const) {
      const covered = cityIsHonestlyCovered(city);
      expect(covered).toBe(false);
    }
  });

  it("counts Montréal, Laval, Québec as honestly covered", () => {
    for (const city of ["Montréal", "Laval", "Québec"] as const) {
      expect(cityIsHonestlyCovered(city)).toBe(true);
    }
  });

  it("honestCoverageCount is <= 4 with current registry", () => {
    expect(honestCoverageCount()).toBeLessThanOrEqual(4);
  });
});

// functions under test (to be implemented in quebec-coverage.ts and imported here)
import { cityIsHonestlyCovered, honestCoverageCount } from "@/lib/quebec-coverage";
```

### Step 1.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/__tests__/coverage-honesty.test.ts`
- Expected: FAIL — `cityIsHonestlyCovered` / `honestCoverageCount` not exported from `@/lib/quebec-coverage`.

### Step 1.3: Implement honesty helpers

- [ ] **Append to `src/lib/quebec-coverage.ts`** (after existing exports):

```ts
import { isDatasetSyncEnabled, DATASETS } from "@/lib/datasets/registry";

/**
 * A city is "honestly covered" only when it has a permit dataset that is
 * sync-enabled (not document_only / unavailable / a search placeholder).
 * Counting a placeholder city as covered is what made the app feel generic.
 */
export function cityIsHonestlyCovered(city: string): boolean {
  const datasetId = CITY_TO_PERMIT_DATASET[city as (typeof COVERAGE_CITIES)[number]];
  if (!datasetId) return false;
  return isDatasetSyncEnabled(datasetId);
}

/** Number of cities with a real, sync-enabled permit feed. */
export function honestCoverageCount(): number {
  return COVERAGE_CITIES.filter(cityIsHonestlyCovered).length;
}

/** Cities that are registered but have no open permit feed yet. */
export function citiesWithoutOpenFeed(): string[] {
  return COVERAGE_CITIES.filter((c) => !cityIsHonestlyCovered(c));
}
```

(Note: `COVERAGE_CITIES` and `CITY_TO_PERMIT_DATASET` are already exported from `registry.ts` / this file.)

### Step 1.4: Fix the test imports

- [ ] Replace the placeholder body of `coverage-honesty.test.ts` top import so it only imports the real functions. Remove the dead `isHonestlyCovered`/`DATASETS` scratch code from Step 1.1, keeping only the three `it(...)` blocks plus `import { cityIsHonestlyCovered, honestCoverageCount, citiesWithoutOpenFeed } from "@/lib/quebec-coverage";`.

### Step 1.5: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/__tests__/coverage-honesty.test.ts`
- Expected: PASS (3 tests).

### Step 1.6: Use honest counts in market-pulse

- [ ] **Edit `src/lib/market-pulse.ts`** — add import at top:
```ts
import { honestCoverageCount, citiesWithoutOpenFeed } from "@/lib/quebec-coverage";
```
- Replace the `coverageCities` / add an `uncoveredCities` line in the returned object (around line 270-273):
```ts
    coverageCities: honestCoverageCount(),
    uncoveredCities: citiesWithoutOpenFeed(),
    registeredSources: getRegisteredSourceCount(),
    searchableMunicipalities: cityBreakdown.filter((city) => city.totalPermits > 0).length,
```
(`coverageCities` previously was `COVERAGE_CITIES.length` — now the honest count.)

### Step 1.7: Lint + typecheck

- [ ] Run: `npm run lint && npm run typecheck`
- Expected: PASS.

### Step 1.8: Commit

- [ ] Run:
```bash
git add src/lib/quebec-coverage.ts src/lib/market-pulse.ts src/lib/__tests__/coverage-honesty.test.ts
git commit -m "feat(coverage): report only sync-enabled permit cities as covered"
```

---

## Task 2: Coordinate parse fix (Québec high-precision WGS84)

**Why before value/contacts:** the map and "near me" filtering depend on it, and it's a one-file root-cause fix that's easy to verify independently. Also fixes future ingestion, not just display.

**Root cause (verified):** `parseLocaleNumber("46.75216566177939")` sees the `.` and notes 14 digits after it (>2), so it treats `.` as a thousands separator and concatenates → `4675216566177939`. Montréal data happens to have fewer decimals so it survived.

**Files:**
- Create: `src/lib/permits/coordinate.ts`
- Create: `src/lib/permits/__tests__/coordinate.test.ts`
- Modify: `src/lib/datasets/fetchers/permits.ts:87-88`
- Modify: `src/lib/datasets/adapters/CityPermitAdapter.ts` (Québec lat/long field)

### Step 2.1: Write the failing test

- [ ] **Create `src/lib/permits/__tests__/coordinate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseCoordinate, repairIntegerCollapsed, isValidCoordinate } from "@/lib/permits/coordinate";

describe("parseCoordinate", () => {
  it("parses a normal WGS84 decimal", () => {
    expect(parseCoordinate("45.5017")).toBeCloseTo(45.5017, 5);
    expect(parseCoordinate("-73.5673")).toBeCloseTo(-73.5673, 5);
  });

  it("parses high-precision Québec coordinates without integer collapse", () => {
    expect(parseCoordinate("46.75216566177939")).toBeCloseTo(46.75216566177939, 10);
    expect(parseCoordinate("-71.63845140691465")).toBeCloseTo(-71.63845140691465, 10);
  });

  it("returns undefined for garbage", () => {
    expect(parseCoordinate("")).toBeUndefined();
    expect(parseCoordinate("Montreal")).toBeUndefined();
  });
});

describe("repairIntegerCollapsed", () => {
  it("repairs an integer-collapsed latitude like 4675216566177939", () => {
    // value came from parseLocaleNumber mangling 46.75216566177939
    expect(repairIntegerCollapsed(4675216566177939, "lat")).toBeCloseTo(46.75216566177939, 8);
  });
  it("repairs an integer-collapsed longitude like -7132845142525129", () => {
    expect(repairIntegerCollapsed(-7132845142525129, "lon")).toBeCloseTo(-71.32845142525129, 8);
  });
  it("returns undefined for a value already in range", () => {
    expect(repairIntegerCollapsed(45.5, "lat")).toBeUndefined();
  });
});

describe("isValidCoordinate", () => {
  it("accepts valid lat/lon ranges", () => {
    expect(isValidCoordinate(45.5, -73.5)).toBe(true);
  });
  it("rejects out-of-range", () => {
    expect(isValidCoordinate(91, -73.5)).toBe(false);
    expect(isValidCoordinate(45.5, -181)).toBe(false);
  });
});
```

### Step 2.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/permits/__tests__/coordinate.test.ts`
- Expected: FAIL — module not found.

### Step 2.3: Implement coordinate helpers

- [ ] **Create `src/lib/permits/coordinate.ts`**

```ts
/**
 * Coordinate parsing for WGS84 lat/lon.
 *
 * The generic parseLocaleNumber mis-parses high-precision decimals like
 * "46.75216566177939" (Québec Ville open data): it treats the dot as a
 * thousands separator (since there are >2 trailing digits) and concatenates
 * into a huge integer (4675216566177939). Coordinates must be parsed
 * explicitly as decimals, never with locale heuristics.
 */

/** Parse a coordinate string as a plain decimal. Undefined if not numeric. */
export function parseCoordinate(value: string | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const clean = value.trim().replace(/[^0-9.\-]/g, "");
  if (!clean || !/^-?\d+(\.\d+)?$/.test(clean)) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Repair a value that was mangled by parseLocaleNumber (integer-collapsed
 * decimal). Returns the repaired decimal, or undefined if the value is already
 * a plausible coordinate and needs no repair.
 *
 * Strategy: Québec lat is ~45-48, lon ~-57 to -79. An integer like
 * 4675216566177939 has the real value "hidden" by shifting the decimal. We
 * find the magnitude shift by comparing to the valid range.
 */
export function repairIntegerCollapsed(
  value: number,
  axis: "lat" | "lon",
): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const limit = axis === "lat" ? 90 : 180;
  if (Math.abs(value) <= limit) return undefined; // already plausible

  // Shift the decimal point left until the value lands in a plausible QC range.
  // Québec: lat 44..63, lon -82..-55. Determine sign from input.
  const sign = value < 0 ? -1 : 1;
  const mag = Math.abs(value);
  const str = mag.toExponential(); // e.g. "4.675216566177939e15"
  const exp = Number(str.split("e")[1]);
  // we want the integer part to have 2 digits (lat) -> divide to bring ~4.6e15 down to ~4.6e1
  const targetLeadingDigits = 2;
  const shift = exp - (targetLeadingDigits - 1); // e.g. 15 - 1 = 14 -> divide by 1e14
  const repaired = mag / Math.pow(10, shift);
  const candidate = sign * repaired;
  if (Math.abs(candidate) <= limit) return candidate;
  return undefined;
}

/** True only when both values are within valid WGS84 ranges. */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}
```

### Step 2.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/permits/__tests__/coordinate.test.ts`
- Expected: PASS (6 tests). If the exponential-shift math for repair is off, adjust `targetLeadingDigits` per axis (lon leading digits are 2-3, e.g. -71 → 2; -113 would be 3 but QC max 2). Document any tweak inline.

### Step 2.5: Use parseCoordinate in the Montréal permit fetcher

- [ ] **Edit `src/lib/datasets/fetchers/permits.ts`**:
  - Change import line 3 to add `parseCoordinate`:
    ```ts
    import { parseCsvLine, parseDate, parseFloatSafe, parseMoney, pick } from "../parser";
    import { parseCoordinate, isValidCoordinate } from "@/lib/permits/coordinate";
    ```
  - Replace lines 87-88:
    ```ts
      latitude: parseCoordinate(pick(row, "latitude", "lat", "y")),
      longitude: parseCoordinate(pick(row, "longitude", "long", "x", "lon")),
    ```

### Step 2.6: Use parseCoordinate in the Québec/city adapter path

- [ ] **Read `src/lib/datasets/adapters/CityPermitAdapter.ts`** to find where Québec lat/long are set. Replace any `parseFloatSafe`/`Number(...)` on lat/long fields with `parseCoordinate(...)`. If the adapter delegates to `parsePermitRows`, this step is already covered by 2.5 and is a no-op — note that in the commit message.

### Step 2.7: Backfill existing integer-collapsed Québec rows

- [ ] **Create `scripts/repair-quebec-coordinates.ts`**:
```ts
import { loadProdEnv } from "./load-prod-env";
import { prisma } from "../src/lib/db";
import { repairIntegerCollapsed, isValidCoordinate } from "../src/lib/permits/coordinate";

loadProdEnv();

async function main() {
  const rows = await prisma.permit.findMany({
    where: {
      OR: [
        { latitude: { gt: 90 } },
        { latitude: { lt: -90 } },
        { longitude: { gt: 180 } },
        { longitude: { lt: -180 } },
      ],
    },
    select: { id: true, latitude: true, longitude: true },
  });
  let fixed = 0;
  for (const r of rows) {
    const lat = r.latitude != null ? (repairIntegerCollapsed(r.latitude, "lat") ?? null) : null;
    const lon = r.longitude != null ? (repairIntegerCollapsed(r.longitude, "lon") ?? null) : null;
    if (lat != null && lon != null && isValidCoordinate(lat, lon)) {
      await prisma.permit.update({ where: { id: r.id }, data: { latitude: lat, longitude: lon } });
      fixed++;
    }
  }
  console.log(`Repaired ${fixed} of ${rows.length} mangled coordinates`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
```
Add to `package.json` scripts: `"repair:coordinates": "npx tsx scripts/repair-quebec-coordinates.ts"`.

### Step 2.8: Add a package.json script + commit

- [ ] Run:
```bash
git add src/lib/permits/coordinate.ts src/lib/permits/__tests__/coordinate.test.ts src/lib/datasets/fetchers/permits.ts src/lib/datasets/adapters/CityPermitAdapter.ts scripts/repair-quebec-coordinates.ts package.json
git commit -m "fix(permits): parse Québec WGS84 coordinates without integer collapse"
```

---

## Task 3: Value estimation engine

**Files:**
- Create: `src/lib/permits/value-estimate.ts`
- Create: `src/lib/permits/__tests__/value-estimate.test.ts`

### Step 3.1: Write the failing test

- [ ] **Create `src/lib/permits/__tests__/value-estimate.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { estimatePermitValue } from "@/lib/permits/value-estimate";

const basePermit = {
  permitType: "Permis de construction",
  workType: "Construction résidentielle",
  city: "Montréal" as string | null,
  borough: "Ville-Marie" as string | null,
  estimatedCost: null as number | null,
};

describe("estimatePermitValue", () => {
  it("returns published when the source has a cost", () => {
    const r = estimatePermitValue({ ...basePermit, estimatedCost: 250000 });
    expect(r.kind).toBe("published");
    if (r.kind === "published") expect(r.value).toBe(250000);
  });

  it("returns an estimated band for a known residential construction type", () => {
    const r = estimatePermitValue(basePermit);
    expect(r.kind).toBe("estimated");
    if (r.kind === "estimated") {
      expect(r.low).toBeGreaterThan(0);
      expect(r.high).toBeGreaterThan(r.low);
      expect(r.basis.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(r.confidence);
    }
  });

  it("returns unknown for an unrecognized type", () => {
    const r = estimatePermitValue({ ...basePermit, permitType: "Certificat d'autorisation", workType: "" });
    expect(r.kind === "unknown" || (r.kind === "estimated" && r.confidence === "low")).toBe(true);
  });

  it("never returns an estimated exact single number", () => {
    const r = estimatePermitValue(basePermit);
    if (r.kind === "estimated") {
      expect(r).not.toHaveProperty("value");
    }
  });
});
```

### Step 3.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/permits/__tests__/value-estimate.test.ts`
- Expected: FAIL — module not found.

### Step 3.3: Implement the engine

- [ ] **Create `src/lib/permits/value-estimate.ts`**

```ts
/**
 * Derived project-value estimation. Montréal & Québec permits never publish
 * cost (verified: estimatedCost is null on all real rows). This engine derives
 * an honest BAND from permitType + workType + RBQ class complexity, widened by
 * city/borough transaction medians when available. Every output is labeled
 * "estimé" in the UI — never a fake exact source number.
 */

export type ValueEstimate =
  | { kind: "published"; value: number; currency: "CAD" }
  | {
      kind: "estimated";
      low: number;
      high: number;
      currency: "CAD";
      confidence: "low" | "medium" | "high";
      basis: string[];
    }
  | { kind: "unknown"; reason: string };

type PermitInput = {
  permitType: string | null | undefined;
  workType?: string | null | undefined;
  city?: string | null | undefined;
  borough?: string | null | undefined;
  estimatedCost?: number | null | undefined;
};

/** RBQ-class complexity multipliers (industry-norm heuristics, NOT source data). */
export const RBQ_COMPLEXITY_MULTIPLIER: Record<string, number> = {
  "1.1.1": 1.4, // new residential building
  "1.1": 1.3,
  "1": 1.2,
  "1.2": 1.5, // foundation
  "1.3": 1.2, // structural
  "2": 0.9, // demolition
  "3": 0.8, // exterior envelope
  "4.1": 1.0, // electrical
  "5": 0.9, // mechanical
  "6.1": 0.85, // plumbing
  "7": 0.8, // gas
};

const TYPE_BANDS: { match: RegExp; low: number; high: number; label: string }[] = [
  { match: /construction résident|construction resident|nouvel/im, low: 180_000, high: 650_000, label: "résidentiel neuf" },
  { match: /agrandiss|extension/im, low: 80_000, high: 350_000, label: "agrandissement" },
  { match: /rénovation|renovation|transformation/i, low: 35_000, high: 220_000, label: "rénovation/transformation" },
  { match: /commercial|industriel/i, low: 100_000, high: 900_000, label: "commercial/industriel" },
  { match: /toiture|enveloppe/i, low: 18_000, high: 140_000, label: "enveloppe/toiture" },
  { match: /plomberie|mécanique|mecanique|cvac|ventilation|électri|electri/i, low: 8_000, high: 90_000, label: "métier (mécanique/électrique)" },
  { match: /démolition|demolition/i, low: 12_000, high: 180_000, label: "démolition" },
  { match: /excavation|fondation/i, low: 20_000, high: 250_000, label: "fondation/excavation" },
];

const MIN_COMPARABLES_FOR_HIGH = 10;

/** Optional comparator hook injected at call site (avoids DB coupling here). */
export type ComparableSalesLookup = (
  city: string | null | undefined,
  borough: string | null | undefined,
) => Promise<{ median: number; count: number } | null>;

export function estimatePermitValue(
  permit: PermitInput,
  options?: { rbqClasses?: string[]; comparableMedian?: number; comparableCount?: number },
): ValueEstimate {
  if (permit.estimatedCost && permit.estimatedCost > 0) {
    return { kind: "published", value: permit.estimatedCost, currency: "CAD" };
  }

  const text = `${permit.permitType ?? ""} ${permit.workType ?? ""}`.trim();
  const band = TYPE_BANDS.find((b) => b.match.test(text));

  if (!band) {
    return {
      kind: "unknown",
      reason: "Type de permis non reconnu pour une estimation de valeur.",
    };
  }

  const classes = options?.rbqClasses ?? [];
  const multiplier = classes
    .map((c) => RBQ_COMPLEXITY_MULTIPLIER[c] ?? 1)
    .reduce((m, x) => Math.max(m, x), 1);

  const low = Math.round((band.low * multiplier) / 1000) * 1000;
  const high = Math.round((band.high * multiplier) / 1000) * 1000;

  const count = options?.comparableCount ?? 0;
  const confidence: "low" | "medium" | "high" =
    count >= MIN_COMPARABLES_FOR_HIGH ? "high" : count > 0 ? "medium" : "low";

  const basis: string[] = [
    `Bande estimée pour travaux de type « ${band.label} ».`,
    classes.length
      ? `Complexité ajustée par classe RBQ (${classes.join(", ")}).`
      : "Aucune classe RBQ publiée ; multiplicateur neutre.",
    count > 0
      ? `${count} transactions comparables à proximité.`
      : "Aucune transaction comparable indexée ; bande prudente.",
    "Estimation dérivée, non publiée par la source — confirmer avant décision.",
  ];

  return { kind: "estimated", low, high, currency: "CAD", confidence, basis };
}
```

### Step 3.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/permits/__tests__/value-estimate.test.ts`
- Expected: PASS (4 tests).

### Step 3.5: Commit

- [ ] Run:
```bash
git add src/lib/permits/value-estimate.ts src/lib/permits/__tests__/value-estimate.test.ts
git commit -m "feat(permits): derive honest value bands when cost is unpublished"
```

---

## Task 4: Contact / who-to-contact resolver

**Files:**
- Create: `src/lib/opportunities/contact-resolver.ts`
- Create: `src/lib/opportunities/__tests__/contact-resolver.test.ts`

### Step 4.1: Write the failing test

- [ ] **Create `src/lib/opportunities/__tests__/contact-resolver.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { resolveContactLeads, rbqClassMatches } from "@/lib/opportunities/contact-resolver";

describe("rbqClassMatches", () => {
  it("matches exact subclass", () => {
    expect(rbqClassMatches("1.1.1", ["1.1.1", "4.1"])).toBe(true);
  });
  it("matches sibling subclass in same family", () => {
    expect(rbqClassMatches("1.1.1", ["1.1.3"])).toBe(true);
    expect(rbqClassMatches("1.1.1", ["1.1"])).toBe(true);
  });
  it("does not match unrelated family", () => {
    expect(rbqClassMatches("1.1.1", ["4.1", "6.1"])).toBe(false);
  });
});

describe("resolveContactLeads", () => {
  it("returns licensed contractors for a permit's required RBQ classes", async () => {
    const findLicensees = vi.fn().mockResolvedValue([
      { id: "1", holderName: "ABC Construction", licenseNumber: "1234-5678-01", subclass: "1.1.1", status: "active", sourceUrl: "https://www.rbq.gouv.qc.ca/" },
      { id: "2", holderName: "XYZ Électrique", licenseNumber: "9999-8888-01", subclass: "4.1", status: "active", sourceUrl: "https://www.rbq.gouv.qc.ca/" },
    ]);
    const r = await resolveContactLeads(
      { kind: "permit", requiredRbqClasses: ["1.1.1"], permitId: "p1" },
      { findLicensees, findAward: vi.fn().mockResolvedValue(null), limit: 5 },
    );
    expect(r.permit).toBeDefined();
    expect(r.permit?.licensedContractors.map((c) => c.holderName)).toEqual(["ABC Construction"]);
    expect(r.permit?.note).toContain("licence RBQ");
  });

  it("returns the awarded contractor for a tender with an award", async () => {
    const findAward = vi.fn().mockResolvedValue({
      vendorName: "Gros œuvre inc.", awardDate: new Date("2026-05-01"), awardValue: 420000,
    });
    const r = await resolveContactLeads(
      { kind: "tender", tenderId: "t1", organization: "Ville de Montréal", sourceUrl: "https://www.seao.ca/1" },
      { findLicensees: vi.fn().mockResolvedValue([]), findAward, limit: 5 },
    );
    expect(r.tender?.awardedContractor?.name).toBe("Gros œuvre inc.");
  });

  it("permit note states these are NOT the applicant", async () => {
    const r = await resolveContactLeads(
      { kind: "permit", requiredRbqClasses: ["1.1.1"], permitId: "p1" },
      { findLicensees: vi.fn().mockResolvedValue([]), findAward: vi.fn().mockResolvedValue(null), limit: 5 },
    );
    expect(r.permit?.note).toMatch(/titulaires|licensed|licence/i);
  });
});
```

### Step 4.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/opportunities/__tests__/contact-resolver.test.ts`
- Expected: FAIL — module not found.

### Step 4.3: Implement the resolver

- [ ] **Create `src/lib/opportunities/contact-resolver.ts`**

```ts
import { prisma } from "@/lib/db";

/**
 * Who-to-contact resolver. Permit applicants/owners are NEVER published
 * (privacy), so this never claims to return "the applicant." Instead, for a
 * permit it returns active RBQ licensees whose subclass matches the required
 * RBQ classes (licensed to do this work), and for a tender it returns the
 * SEAO-awarded contractor when one is indexed.
 *
 * RbqLicense has NO region column, so matching is subclass-only.
 */

export type ContactLead = {
  holderName: string;
  licenseNumber: string;
  subclass: string;
  sourceUrl: string;
};

export type ContactLeads = {
  permit?: {
    licensedContractors: ContactLead[];
    note: string;
  };
  tender?: {
    buyer: string;
    awardedContractor?: { name: string; date: string; value: number | null };
    sourceUrl: string;
  };
};

type LicenseeRow = {
  id: string;
  holderName: string;
  licenseNumber: string;
  subclass: string;
  status: string;
  sourceUrl: string;
};

/** Match a licensee subclass against required classes (same family or exact). */
export function rbqClassMatches(required: string, licenseeSubclasses: string[]): boolean {
  const fam = required.split(".").slice(0, 2).join("."); // "1.1.1" -> "1.1"
  return licenseeSubclasses.some((s) => s === required || s.startsWith(fam + ".") || s === fam);
}

export type ResolveInput =
  | { kind: "permit"; permitId: string; requiredRbqClasses: string[] }
  | { kind: "tender"; tenderId: string; organization?: string | null; sourceUrl: string };

export type ResolveDeps = {
  findLicensees: (subclassesFilter?: string[]) => Promise<LicenseeRow[]>;
  findAward: (tenderId: string) => Promise<{ vendorName: string; awardDate: Date; awardValue: number | null } | null>;
  limit: number;
};

const NOTE_FR =
  "Liste d'entreprises titulaires d'une licence RBQ pour ce type de travaux (région non filtrée). Il ne s'agit PAS du demandeur du permis.";
const NOTE_EN =
  "List of enterprises holding an RBQ licence for this type of work (region not filtered). These are NOT the permit applicant.";

export async function resolveContactLeads(
  input: ResolveInput,
  deps: ResolveDeps,
): Promise<ContactLeads> {
  if (input.kind === "permit") {
    const required = input.requiredRbqClasses ?? [];
    const all = await deps.findLicensees();
    const matched = all
      .filter((l) => l.status === "active" && rbqClassMatches(l.subclass, required))
      .map((l) => ({
        holderName: l.holderName,
        licenseNumber: l.licenseNumber,
        subclass: l.subclass,
        sourceUrl: l.sourceUrl,
      }))
      .slice(0, deps.limit);
    return { permit: { licensedContractors: matched, note: NOTE_FR + " / " + NOTE_EN } };
  }

  // tender
  const award = await deps.findAward(input.tenderId);
  return {
    tender: {
      buyer: input.organization ?? "Organisme acheteur",
      awardedContractor: award
        ? { name: award.vendorName, date: award.awardDate.toISOString(), value: award.awardValue }
        : undefined,
      sourceUrl: input.sourceUrl,
    },
  };
}

/** Production dependency wiring against Prisma. */
export function productionDeps(limit = 8): ResolveDeps {
  return {
    limit,
    findLicensees: async () => {
      const rows = await prisma.rbqLicense.findMany({
        where: { status: "active" },
        select: {
          id: true,
          holderName: true,
          licenseNumber: true,
          subclass: true,
          status: true,
          sourceUrl: true,
        },
        take: 5000, // filter in-memory by subclass family (RbqLicense has no region)
      });
      return rows as LicenseeRow[];
    },
    findAward: async (tenderId) => {
      const award = await prisma.tenderAward.findFirst({
        where: { tenderId },
        orderBy: { awardDate: "desc" },
        select: { vendorName: true, awardDate: true, awardValue: true },
      });
      if (!award) return null;
      return {
        vendorName: award.vendorName,
        awardDate: award.awardDate,
        awardValue: award.awardValue ?? null,
      };
    },
  };
}
```

### Step 4.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/opportunities/__tests__/contact-resolver.test.ts`
- Expected: PASS (5 tests). If the prisma import path differs, check `src/lib/db.ts` exists; if the project uses a different client accessor, point `productionDeps` at it instead.

### Step 4.5: Commit

- [ ] Run:
```bash
git add src/lib/opportunities/contact-resolver.ts src/lib/opportunities/__tests__/contact-resolver.test.ts
git commit -m "feat(opportunities): resolve licensed RBQ contractors and SEAO awards"
```

---

## Task 5: Profile-aware opportunity fit-score

**Why:** the current `contractor-fit.ts` does keyword matching — the source of "generic/weak" ranking. This new scorer uses the signed-in user's RBQ class, regions, trades, and budget against the value estimate.

**Files:**
- Create: `src/lib/opportunities/contractor-fit-profile.ts`
- Create: `src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`

### Step 5.1: Write the failing test

- [ ] **Create `src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { scoreOpportunityForUser } from "@/lib/opportunities/contractor-fit-profile";

const profile = {
  rbqLicenseClass: "1.1.1",
  trades: ["construction", "résidentiel"],
  regions: ["Montréal"],
  minProjectCost: 50_000,
  maxProjectCost: 500_000,
};

describe("scoreOpportunityForUser", () => {
  it("scores high when RBQ class, region, and value band all match", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["1.1.1"],
        city: "Montréal",
        permitType: "Construction résidentielle",
        valueEstimate: { kind: "estimated", low: 120_000, high: 400_000, currency: "CAD", confidence: "high", basis: [] },
      },
      profile,
    );
    expect(s.score).toBeGreaterThanOrEqual(80);
    expect(s.breakdown.some((b) => b.id === "rbq_class_match")).toBe(true);
    expect(s.breakdown.some((b) => b.id === "region_match")).toBe(true);
    expect(s.breakdown.some((b) => b.id === "value_in_budget")).toBe(true);
  });

  it("scores low when RBQ class does not match", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["4.1"],
        city: "Montréal",
        permitType: "Électrique",
        valueEstimate: { kind: "estimated", low: 10_000, high: 60_000, currency: "CAD", confidence: "medium", basis: [] },
      },
      profile,
    );
    expect(s.score).toBeLessThan(40);
  });

  it("returns a public anonymized score when profile is null", () => {
    const s = scoreOpportunityForUser(
      {
        kind: "permit",
        requiredRbqClasses: ["1.1.1"],
        city: "Montréal",
        permitType: "Construction résidentielle",
        valueEstimate: { kind: "estimated", low: 120_000, high: 400_000, currency: "CAD", confidence: "high", basis: [] },
      },
      null,
    );
    expect(s.breakdown.some((b) => b.id === "anonymous")).toBe(true);
  });
});
```

### Step 5.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`
- Expected: FAIL — module not found.

### Step 5.3: Implement the scorer

- [ ] **Create `src/lib/opportunities/contractor-fit-profile.ts`**

```ts
import type { ValueEstimate } from "@/lib/permits/value-estimate";
import { rbqClassMatches } from "@/lib/opportunities/contact-resolver";

export type ContractorProfile = {
  rbqLicenseClass?: string | null;
  trades?: string[] | null;
  regions?: string[] | null;
  minProjectCost?: number | null;
  maxProjectCost?: number | null;
};

export type FitBreakdown = { id: string; label: string; points: number };

export type FitScore = {
  score: number; // 0-100
  level: "strong" | "related" | "support" | "weak";
  breakdown: FitBreakdown[];
};

type OpportunityInput = {
  kind: "permit" | "tender";
  requiredRbqClasses?: string[];
  city?: string | null;
  region?: string | null;
  permitType?: string | null;
  title?: string | null;
  valueEstimate?: ValueEstimate;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreOpportunityForUser(
  item: OpportunityInput,
  profile: ContractorProfile | null,
): FitScore {
  // Public (anonymous) surface: a coarse magnet score, no personalization.
  if (!profile) {
    const typeBonus =
      /construction|rénovation|renovation|transformation|agrandiss/i.test(
        `${item.permitType ?? ""} ${item.title ?? ""}`,
      )
        ? 55
        : 25;
    return {
      score: clamp(typeBonus),
      level: typeBonus >= 50 ? "related" : "weak",
      breakdown: [{ id: "anonymous", label: "Score public non personnalisé", points: typeBonus }],
    };
  }

  const breakdown: FitBreakdown[] = [];

  // RBQ class match (heaviest signal)
  const required = item.requiredRbqClasses ?? [];
  const profileClass = profile.rbqLicenseClass ?? "";
  const classMatches =
    required.length > 0 && profileClass
      ? rbqClassMatches(profileClass, required)
      : false;
  if (classMatches) breakdown.push({ id: "rbq_class_match", label: "Classe RBQ correspondante", points: 40 });
  else if (required.length > 0) breakdown.push({ id: "rbq_class_mismatch", label: "Classe RBQ non correspondante", points: -20 });

  // Region match
  const itemRegion = (item.city ?? item.region ?? "")?.toLowerCase();
  const regions = (profile.regions ?? []).map((r) => r.toLowerCase());
  const regionMatch = regions.some((r) => itemRegion.includes(r) || r.includes(itemRegion));
  if (regionMatch && itemRegion) breakdown.push({ id: "region_match", label: "Région desservie", points: 20 });
  else if (itemRegion) breakdown.push({ id: "region_mismatch", label: "Hors région desservie", points: -10 });

  // Value band vs budget
  const v = item.valueEstimate;
  const minB = profile.minProjectCost ?? 0;
  const maxB = profile.maxProjectCost ?? Infinity;
  if (v?.kind === "estimated" || v?.kind === "published") {
    const low = v.kind === "estimated" ? v.low : v.value;
    const high = v.kind === "estimated" ? v.high : v.value;
    const overlaps = high >= minB && low <= maxB;
    if (overlaps) breakdown.push({ id: "value_in_budget", label: "Valeur dans la plage de projets", points: 25 });
    else breakdown.push({ id: "value_outside_budget", label: "Valeur hors plage de projets", points: -15 });
  } else {
    breakdown.push({ id: "value_unknown", label: "Valeur non estimée", points: 0 });
  }

  // Trade keyword intersection
  const text = `${item.permitType ?? ""} ${item.title ?? ""}`.toLowerCase();
  const trades = (profile.trades ?? []).map((t) => t.toLowerCase());
  const tradeHits = trades.filter((t) => t && (text.includes(t) || text.includes(t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))));
  if (tradeHits.length) breakdown.push({ id: "trade_match", label: "Métier correspondant", points: 15 });

  const raw = breakdown.reduce((sum, b) => sum + b.points, 50); // base 50
  const score = clamp(raw);
  const level: FitScore["level"] = score >= 75 ? "strong" : score >= 55 ? "related" : score >= 35 ? "support" : "weak";
  return { score, level, breakdown };
}
```

### Step 5.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`
- Expected: PASS (3 tests).

### Step 5.5: Commit

- [ ] Run:
```bash
git add src/lib/opportunities/contractor-fit-profile.ts src/lib/opportunities/__tests__/contractor-fit-profile.test.ts
git commit -m "feat(opportunities): profile-aware RBQ/region/budget fit-score"
```

---

## Task 6: Parcel compliance verdict

**Files:**
- Create: `src/lib/compliance/parcel-verdict.ts`
- Create: `src/lib/compliance/__tests__/parcel-verdict.test.ts`

### Step 6.1: Write the failing test

- [ ] **Create `src/lib/compliance/__tests__/parcel-verdict.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { assessParcel } from "@/lib/compliance/parcel-verdict";

describe("assessParcel", () => {
  it("returns constraint_present when a contaminated site is near", async () => {
    const findContaminated = vi.fn().mockResolvedValue([{ id: "c1", name: "Site X", sourceUrl: "http://s" }]);
    const findHeritage = vi.fn().mockResolvedValue([]);
    const r = await assessParcel(46.8, -71.2, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("constraint_present");
    expect(r.constraints.some((c) => c.kind === "contamination")).toBe(true);
  });

  it("returns clear when no layers flag and layers were checked", async () => {
    const findContaminated = vi.fn().mockResolvedValue([]);
    const findHeritage = vi.fn().mockResolvedValue([]);
    const r = await assessParcel(45.5, -73.6, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("clear");
    expect(r.note).toContain("clear");
  });

  it("returns unknown_layer when a layer lookup threw", async () => {
    const findContaminated = vi.fn().mockRejectedValue(new Error("db down"));
    const findHeritage = vi.fn().mockResolvedValue([]);
    const r = await assessParcel(45.5, -73.6, { findContaminated, findHeritage, radiusMeters: 500 });
    expect(r.status).toBe("unknown_layer");
  });
});
```

### Step 6.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/parcel-verdict.test.ts`
- Expected: FAIL — module not found.

### Step 6.3: Implement the verdict

- [ ] **Create `src/lib/compliance/parcel-verdict.ts`**

```ts
import { prisma } from "@/lib/db";

/**
 * Parcel compliance verdict assembled from REAL indexed layers only:
 * ContaminatedSite (GTC) and HeritageSite. Replaces the generic "verify zoning"
 * limitation with an actual tri-state. A layer that errors degrades the verdict
 * to unknown_layer rather than fabricating a clear result.
 */

export type ParcelConstraint = {
  kind: "contamination" | "heritage" | "zoning";
  label: string;
  sourceUrl: string;
};

export type ParcelVerdict = {
  status: "clear" | "constraint_present" | "unknown_layer";
  constraints: ParcelConstraint[];
  note: string;
};

export type AssessDeps = {
  findContaminated: (lat: number, lon: number, radiusMeters: number) => Promise<{ id: string; name?: string | null; sourceUrl?: string | null }[]>;
  findHeritage: (lat: number, lon: number, radiusMeters: number) => Promise<{ id: string; name?: string | null; sourceUrl?: string | null }[]>;
  radiusMeters: number;
};

const CLEAR_FR = "Aucune contrainte indexée (contamination, patrimoine) à proximité immédiate.";
const CLEAR_EN = "No indexed constraint (contamination, heritage) found nearby.";

export async function assessParcel(
  lat: number,
  lon: number,
  deps: AssessDeps,
): Promise<ParcelVerdict> {
  const constraints: ParcelConstraint[] = [];
  let unknown = false;

  try {
    const sites = await deps.findContaminated(lat, lon, deps.radiusMeters);
    for (const s of sites.slice(0, 5)) {
      constraints.push({
        kind: "contamination",
        label: s.name ?? "Terrain contaminé (GTC)",
        sourceUrl: s.sourceUrl ?? "https://www.donneesquebec.ca/recherche/dataset/repertoire-des-terrains-contamines-gtc",
      });
    }
  } catch {
    unknown = true;
  }

  try {
    const herit = await deps.findHeritage(lat, lon, deps.radiusMeters);
    for (const h of herit.slice(0, 5)) {
      constraints.push({
        kind: "heritage",
        label: h.name ?? "Immeuble patrimonial indexé",
        sourceUrl: h.sourceUrl ?? "https://www.donneesquebec.ca/recherche/dataset/vmtl-les-edifices-patrimoniaux-de-montreal",
      });
    }
  } catch {
    unknown = true;
  }

  if (unknown) {
    return {
      status: "unknown_layer",
      constraints,
      note: "Une couche réglementaire n'a pu être vérifiée ; confirmer zonage/contraintes à la source.",
    };
  }
  if (constraints.length > 0) {
    return {
      status: "constraint_present",
      constraints,
      note: `${constraints.length} contrainte(s) indexée(s) à proximité — vérifier l'incidence avant projet.`,
    };
  }
  return { status: "clear", constraints, note: CLEAR_FR + " / " + CLEAR_EN };
}

/** Production dependency wiring. Uses a coarse bounding-box prefilter (fast). */
export function productionParcelDeps(radiusMeters = 500): AssessDeps {
  const deg = radiusMeters / 111_000; // ~meters to degrees
  return {
    radiusMeters,
    findContaminated: async (lat, lon) => {
      const rows = await prisma.contaminatedSite.findMany({
        where: {
          AND: [
            { latitude: { gte: lat - deg } },
            { latitude: { lte: lat + deg } },
            { longitude: { gte: lon - deg } },
            { longitude: { lte: lon + deg } },
          ],
        },
        select: { id: true, name: true, sourceUrl: true },
        take: 5,
      });
      return rows as { id: string; name?: string | null; sourceUrl?: string | null }[];
    },
    findHeritage: async (lat, lon) => {
      const rows = await prisma.heritageSite.findMany({
        where: {
          AND: [
            { latitude: { gte: lat - deg } },
            { latitude: { lte: lat + deg } },
            { longitude: { gte: lon - deg } },
            { longitude: { lte: lon + deg } },
          ],
        },
        select: { id: true, name: true, sourceUrl: true },
        take: 5,
      });
      return rows as { id: string; name?: string | null; sourceUrl?: string | null }[];
    },
  };
}
```

**Before this step, verify the real column names on `ContaminatedSite` and `HeritageSite`** (`prisma/schema.prisma` lines ~302, ~589) — if the lat/long columns are named differently (e.g. `lat`/`lng`), adjust the `select`/`where`. Confirm `prisma` is exported from `src/lib/db.ts`.

### Step 6.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/parcel-verdict.test.ts`
- Expected: PASS (3 tests).

### Step 6.5: Commit

- [ ] Run:
```bash
git add src/lib/compliance/parcel-verdict.ts src/lib/compliance/__tests__/parcel-verdict.test.ts
git commit -m "feat(compliance): parcel contamination/heritage verdict from indexed layers"
```

---

## Task 7: Wire value + contacts into OpportunityDossier

**Why:** this is where the new intelligence becomes visible in the live feed — the integration point the deploy verification will assert.

**Files:**
- Modify: `src/lib/domain/quebec.ts:128-203`
- Modify: `src/lib/opportunities/dossier.ts`
- Modify: `src/app/api/feed/route.ts:222,302`

### Step 7.1: Extend the OpportunityDossier type

- [ ] **Edit `src/lib/domain/quebec.ts`** — add imports near the top:
```ts
import type { ValueEstimate } from "@/lib/permits/value-estimate";
import type { ContactLeads } from "@/lib/opportunities/contact-resolver";
import type { ParcelVerdict } from "@/lib/compliance/parcel-verdict";
```
- Add three optional fields to `OpportunityDossier` (after `exportAction`):
```ts
  valueEstimate?: ValueEstimate;
  contactLeads?: ContactLeads;
  parcelVerdict?: ParcelVerdict;
```

### Step 7.2: Thread inputs through the dossier builders

- [ ] **Edit `src/lib/opportunities/dossier.ts`**:
  - Extend `PermitDossierInput` and `TenderDossierInput` types with optional fields:
    ```ts
    // in PermitDossierInput add:
    valueEstimate?: ValueEstimate;
    contactLeads?: ContactLeads;
    parcelVerdict?: ParcelVerdict;
    // in TenderDossierInput add:
    valueEstimate?: ValueEstimate;
    contactLeads?: ContactLeads;
    ```
    and add the corresponding imports at top:
    ```ts
    import type { ValueEstimate } from "@/lib/permits/value-estimate";
    import type { ContactLeads } from "@/lib/opportunities/contact-resolver";
    import type { ParcelVerdict } from "@/lib/compliance/parcel-verdict";
    ```
  - In `buildPermitOpportunityDossier`, add to the returned object (before the closing brace):
    ```ts
    valueEstimate: input.valueEstimate,
    contactLeads: input.contactLeads,
    parcelVerdict: input.parcelVerdict,
    ```
  - In `buildTenderOpportunityDossier`, add to the returned object:
    ```ts
    valueEstimate: input.valueEstimate,
    contactLeads: input.contactLeads,
    ```

### Step 7.3: Compute and pass the new fields in the feed route

- [ ] **Read `src/app/api/feed/route.ts:1-60`** to confirm imports. Add:
```ts
import { estimatePermitValue } from "@/lib/permits/value-estimate";
import { resolveContactLeads, productionDeps as contactDeps } from "@/lib/opportunities/contact-resolver";
import { assessParcel, productionParcelDeps } from "@/lib/compliance/parcel-verdict";
```
- In the permit enrichment loop (around line 222), before `buildPermitOpportunityDossier`, compute:
```ts
      const valueEstimate = estimatePermitValue({
        permitType: p.permitType,
        workType: p.workType,
        city: p.city,
        borough: p.borough,
        estimatedCost: p.estimatedCost,
      });
      const reqClasses = (() => {
        try { return JSON.parse((p as { requiredRbqClasses?: string | null }).requiredRbqClasses ?? "[]") as string[]; }
        catch { return []; }
      })();
      const contactLeads = await resolveContactLeads(
        { kind: "permit", permitId: p.id, requiredRbqClasses: reqClasses },
        contactDeps(8),
      ).catch(() => undefined);
      const parcelVerdict =
        p.latitude != null && p.longitude != null
          ? await assessParcel(p.latitude, p.longitude, productionParcelDeps(500)).catch(() => undefined)
          : undefined;
```
  Then pass them into the builder:
```ts
      const opportunityDossier = buildPermitOpportunityDossier({
        permit: p,
        score: pipeline.score,
        signals,
        pipeline,
        dataQuality,
        intelligence,
        locale,
        valueEstimate,
        contactLeads,
        parcelVerdict,
      });
```
- For tenders (around line 302), add:
```ts
      const tenderValue: ValueEstimate | undefined = t.estimatedValue
        ? { kind: "published", value: t.estimatedValue, currency: "CAD" }
        : undefined;
      const contactLeads = await resolveContactLeads(
        { kind: "tender", tenderId: t.id, organization: t.organization, sourceUrl: t.sourceUrl },
        contactDeps(8),
      ).catch(() => undefined);
```
  and pass `valueEstimate: tenderValue, contactLeads` into `buildTenderOpportunityDossier`. Add the `ValueEstimate` type import at the top of the route file.

**Performance guard:** the permit loop already uses `Promise.all`; each `resolveContactLeads`/`assessParcel` is awaited per item. Because `productionDeps().findLicensees` pulls up to 5000 RBQ rows per call, **memoize the licensee list once per request**: hoist a `let licenseesCache: LicenseeRow[] | null = null` and have `productionDeps` accept an optional shared array. If this is too invasive, cap the feed's permit count to the existing `take: 12` top leads and run contacts only for those (which the code already does — `intelligenceCandidateIds`/top 12). Confirm the contact resolution only runs on the enriched/top set, not every permit, to avoid N×5000 queries.

### Step 7.4: Update the existing dossier tests so they don't break on new optional fields

- [ ] Run: `npx vitest run src/lib/opportunities/dossier.test.ts`
- Expected: PASS (fields are optional; existing tests should still pass). If any snapshot/assertion enumerates dossier keys, update it to expect the three new optional keys.

### Step 7.5: Lint + typecheck + full test

- [ ] Run: `npm run lint && npm run typecheck && npm run test`
- Expected: PASS across all suites. Fix any type errors (commonly: the `requiredRbqClasses` field on the permit type — it's a JSON string column; ensure the cast compiles).

### Step 7.6: Commit

- [ ] Run:
```bash
git add src/lib/domain/quebec.ts src/lib/opportunities/dossier.ts src/app/api/feed/route.ts src/lib/opportunities/dossier.test.ts
git commit -m "feat(feed): surface derived value, licensed contacts, and parcel verdict in dossiers"
```

---

## Task 8: Deploy + honest verification

**Why last:** the deploy only counts as "done" when a live feed item actually shows the new derived fields. No "everything is working" claim without this proof.

**Files:**
- Modify: `scripts/verify-deploy.ts`

### Step 8.1: Add assertions for the new fields

- [ ] **Read `scripts/verify-deploy.ts`** to find the existing `/api/feed` check. Add a new check after it:
```ts
// Verify a live feed permit dossier actually carries the new intelligence.
const feedRes = await fetch(`${APP_URL}/api/feed?limit=20&locale=fr`);
const feedJson = await feedRes.json();
const permitWithIntel = feedJson.items?.find(
  (i: { kind: string; opportunityDossier?: { valueEstimate?: unknown; contactLeads?: unknown } }) =>
    i.kind === "permit" && i.opportunityDossier?.valueEstimate,
);
assert(permitWithIntel, "live feed must include a permit with a valueEstimate block");
const ve = permitWithIntel.opportunityDossier.valueEstimate as { kind: string };
assert(ve.kind === "estimated" || ve.kind === "published", `valueEstimate.kind was ${ve.kind}`);
assert(permitWithIntel.opportunityDossier.contactLeads, "permit dossier must include a contactLeads block");
console.log("OK feed permit carries valueEstimate + contactLeads");
```
Add this as a numbered check in the same array/runner the existing checks use. Increment the total check count in any summary output.

### Step 8.2: Run the full local CI gate

- [ ] Run: `npm run ci` (lint + typecheck + test + build)
- Expected: PASS. Fix anything red before deploying.

### Step 8.3: Run the coordinate repair on local dev DB (smoke)

- [ ] Run: `npm run repair:coordinates`
- Expected: logs "Repaired N of M mangled coordinates" with N > 0 if the dev DB had Québec rows. (This only matters locally; production repair runs post-deploy.)

### Step 8.4: Push to GitHub

- [ ] Run:
```bash
git push origin main
```
- Expected: push succeeds; GitHub Actions CI runs and passes. Verify at the repo Actions tab.

### Step 8.5: Deploy to Vercel production

- [ ] Run: `npx vercel --prod`
- Expected: deployment finishes READY. Note the deployment URL/id.

### Step 8.6: Repair production coordinates + re-sync permits

- [ ] Run: `npm run repair:coordinates` against the production DATABASE_URL (loaded via `loadProdEnv()`).
- Expected: repairs the integer-collapsed Québec rows in Postgres.
- [ ] Trigger a permit re-sync so new ingestion uses the fixed parser:
```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/cron/sync?mode=rgm"
```
- Expected: 200/202; sync runs.

### Step 8.7: Run the live verifier

- [ ] Run: `npm run verify:deploy`
- Expected: ALL checks pass, including the new valueEstimate + contactLeads assertion. **If this fails, the deploy is NOT done — do not claim success.**

### Step 8.8: Spot-check the live feed manually

- [ ] Run:
```bash
curl -s "$NEXT_PUBLIC_APP_URL/api/feed?limit=3&locale=fr" | head -c 3000
curl -s "$NEXT_PUBLIC_APP_URL/api/coverage/public" | head -c 1500
```
- Verify in the JSON:
  - At least one permit `opportunityDossier.valueEstimate.kind === "estimated"` with a `basis` array and `confidence`.
  - At least one permit `opportunityDossier.contactLeads.permit.note` mentions "licence RBQ" / "NOT the applicant".
  - `coverageCities` is now the honest count (≤ 4), not 17.
  - A Québec permit row has `latitude`/`longitude` in valid decimal range (e.g. `46.7x`, `-71.6x`).

### Step 8.9: Check fresh Vercel logs for new errors

- [ ] Run: `npx vercel logs [deployment-url]` or check the dashboard.
- Expected: no new 500s or DB timeout errors introduced by the contact/parcel lookups. If RBQ query pressure is high, lower the `productionDeps(8)` cap or cache the licensee list per request (Step 7.3 perf guard).

### Step 8.10: Final commit + report

- [ ] Run:
```bash
git add scripts/verify-deploy.ts
git commit -m "chore(verify): assert live feed carries value + contact intelligence"
git push origin main
```
- Report the **real** evidence to the operator: the exact `valueEstimate` and `contactLeads` blocks from a live feed item, the honest `coverageCities` number, and a sample repaired Québec coordinate. Do not write "everything is working" unless every check in 8.2/8.7/8.8 passed.

---

## Self-Review (run after writing, before execution)

- [x] **Spec coverage:** Honest coverage (T1), coordinate fix (T2), value derivation (T3), contact resolver (T4), profile fit-score (T5), parcel verdict (T6), wiring (T7), deploy+verify (T8) — all 7 spec sections + verification gate covered.
- [x] **Placeholder scan:** no TBD/TODO/"add error handling" left; every code step shows full code.
- [x] **Type consistency:** `ValueEstimate`, `ContactLeads`, `ParcelVerdict`, `FitScore` defined once and referenced consistently across tasks. `rbqClassMatches` defined in T4, imported in T5. `productionDeps`/`productionParcelDeps` consistent names.
- [x] **Scope:** focused on depth, no new datasets, no scraping — matches the approved spec.
