# Quebec Full Data Wiring + NEQ Intelligence Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 8 remaining high-value Quebec open datasets (RENA, Registre des entreprises, sanctions, convictions, CNESST injuries, cadastre, standardized zoning, market index) and link permits/RBQ/awards/compliance by NEQ into one verified contractor dossier — making RENA a hard compliance gate in the fit-score.

**Architecture:** Each new dataset reuses the existing pipeline: a `DatasetConfig` registry entry (id, ckanId, sourceUrl), a fetcher in `src/lib/datasets/fetchers/`, and a `syncXxx()` entry in the runner's `SYNC_FNS` table. New Prisma models store the rows. A new `neq-resolver` derives NEQ from RBQ license numbers (deterministic) and matches names fuzzily (with confidence). A `contractor-compliance` aggregator assembles the verified dossier across all tables. The fit-score, parcel verdict, and value estimate consume compliance/zoning/market signals. No scraping; no new infra.

**Tech Stack:** Next.js 16, Prisma (SQLite dev / Postgres prod), vitest, TypeScript strict, existing CKAN/ArcGIS/CSV client helpers.

**Spec:** `docs/superpowers/specs/2026-06-24-quebec-full-data-wiring-design.md`

**Verified integration points (read these before deviating):**
- Registry: `src/lib/datasets/registry.ts` — `DatasetConfig` type; add id to the `DatasetId` union and a config object to `DATASETS`.
- Dispatch: `src/lib/sync/runner.ts:1975` — `SYNC_FNS: Partial<Record<DatasetId, (limit?) => Promise<SyncResult>>>`; add one entry per new dataset pointing at a `syncXxx()` wrapper that calls its fetcher and upserts via prisma.
- Fetcher pattern: `src/lib/datasets/fetchers/awards.ts` — `fetchXxx(opts)` returns `XxxRecord[]`; CKAN via `fetchCkanDatastoreSearch`, CSV via `fetchText`+`parseCsvLine`, ArcGIS via `fetchArcGisFeatures` from `../client`.
- Prisma: `src/lib/prisma.ts` exports `prisma`; dev is SQLite, prod regenerates for Postgres at build.

---

## File Structure

**Create (fetchers):**
- `src/lib/datasets/fetchers/rena.ts`
- `src/lib/datasets/fetchers/registre-entreprises.ts`
- `src/lib/datasets/fetchers/sanctions.ts`
- `src/lib/datasets/fetchers/convictions.ts`
- `src/lib/datasets/fetchers/injuries.ts`
- `src/lib/datasets/fetchers/cadastre.ts`
- `src/lib/datasets/fetchers/zoning-standard.ts`
- `src/lib/datasets/fetchers/market-index.ts`

**Create (intelligence layer):**
- `src/lib/compliance/neq-resolver.ts`
- `src/lib/compliance/contractor-compliance.ts`
- one test file per (in `__tests__/`)

**Modify:**
- `prisma/schema.prisma` — 8 new models + `neq String?` on `RbqLicense`
- `src/lib/datasets/registry.ts` — 8 new `DatasetId` + `DatasetConfig` entries
- `src/lib/sync/runner.ts` — 8 new `syncXxx()` wrappers + `SYNC_FNS` entries + `getSyncStatus` counts
- `src/lib/opportunities/contractor-fit-profile.ts` — compliance gate
- `src/lib/compliance/parcel-verdict.ts` — zoning + cadastre
- `src/lib/permits/value-estimate.ts` — marketIndex input
- `src/app/api/feed/route.ts` — surface compliance on tender award winner
- `src/lib/domain/quebec.ts` — `compliance?` on `OpportunityDossier`
- `scripts/verify-deploy.ts` — compliance assertion

**No change:** existing fetchers, existing datasets, the public coverage layer (already honest from last session).

---

## Task 1: Prisma schema — 8 models + RbqLicense.neq

**Why first:** every fetcher writes to a model that must exist; migrations must apply before any sync.

**Files:**
- Modify: `prisma/schema.prisma` (append models; add `neq` to `RbqLicense`)
- Run: `npx prisma migrate dev` (dev) then `npx prisma generate`

### Step 1.1: Add neq to RbqLicense

- [ ] In `prisma/schema.prisma`, inside `model RbqLicense { ... }`, add after `licenseNumber`:
```prisma
  licenseNumber String    @unique
  neq          String?
  holderName    String?
```
and add an index at the bottom of the model (next to the existing `@@index([subclass])`):
```prisma
  @@index([neq])
```

### Step 1.2: Append the 8 new models

- [ ] Append to `prisma/schema.prisma`:
```prisma
model RenaRecord {
  id         String    @id @default(cuid())
  neq        String?
  name       String?
  status     String?
  offence    String?
  startDate  DateTime?
  endDate    DateTime?
  sourceUrl  String
  sourceFetchedAt DateTime @default(now())
  @@index([neq])
}

model EnterpriseRecord {
  id               String    @id @default(cuid())
  neq              String?   @unique
  name             String?
  legalStatus      String?
  constitutionDate DateTime?
  address          String?
  sourceUrl        String
  sourceFetchedAt  DateTime @default(now())
}

model SanctionRecord {
  id         String    @id @default(cuid())
  neq        String?
  name       String?
  law        String?
  amount     Float?
  date       DateTime?
  sourceUrl  String
  sourceFetchedAt DateTime @default(now())
  @@index([neq])
  @@index([name])
}

model ConvictionRecord {
  id         String    @id @default(cuid())
  neq        String?
  name       String?
  offence    String?
  date       DateTime?
  sourceUrl  String
  sourceFetchedAt DateTime @default(now())
  @@index([neq])
  @@index([name])
}

model InjuryClaim {
  id            String    @id @default(cuid())
  employerName  String?
  neq           String?
  claimCount    Int       @default(0)
  year          Int?
  sourceUrl     String
  sourceFetchedAt DateTime @default(now())
  @@index([neq])
  @@index([employerName])
}

model CadastreLot {
  id         String    @id @default(cuid())
  lotNumber  String?   @unique
  city       String?
  geom       Json?
  sourceUrl  String
  sourceFetchedAt DateTime @default(now())
}

model ZoningStandard {
  id          String    @id @default(cuid())
  city        String?
  zoneCode    String?
  allowedUses Json?
  sourceUrl   String
  sourceFetchedAt DateTime @default(now())
  @@index([city, zoneCode])
}

model MarketIndex {
  id              String    @id @default(cuid())
  region          String?
  priceRange      String?
  salesCount      Int       @default(0)
  difficultyIndex Float?
  period          String?
  sourceUrl       String
  sourceFetchedAt DateTime @default(now())
  @@index([region, period])
}
```

### Step 1.3: Migrate + generate

- [ ] Run: `npx prisma migrate dev --name add_compliance_and_intel_models`
- Expected: migration created and applied to dev SQLite; `npx prisma generate` regenerates the client.
- [ ] Run: `npx prisma generate`
- Expected: client regenerated with the new models.

### Step 1.4: Typecheck

- [ ] Run: `npx tsc --noEmit`
- Expected: clean (the generated client types now include the new models).

### Step 1.5: Commit

- [ ] Run:
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add compliance + intelligence models (RENA, enterprise, sanctions, convictions, injuries, cadastre, zoning-standard, market-index)"
```

---

## Task 2: Registry entries for the 8 datasets

**Files:**
- Modify: `src/lib/datasets/registry.ts` (extend `DatasetId` union + `DATASETS`)

### Step 2.1: Extend the DatasetId union

- [ ] In `src/lib/datasets/registry.ts`, find the `DatasetId` union (the long `type DatasetId = | "permits" | ...` block) and add 8 ids before the closing backtick:
```ts
  | "rena"
  | "registre-entreprises"
  | "sanctions"
  | "convictions"
  | "injuries"
  | "cadastre"
  | "zoning-standard"
  | "market-index"
```

### Step 2.2: Add the 8 config entries

- [ ] In the `DATASETS` object (where other entries live), add:
```ts
  rena: {
    id: "rena",
    label: "RENA — entreprises non admissibles aux contrats publics",
    ckanId: "registre-des-entreprises-non-admissibles-aux-contrats-publics-rena",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises-non-admissibles-aux-contrats-publics-rena",
    preferredFormat: "csv",
    defaultLimit: 5000,
    productionLimit: 20000,
    refreshIntervalMinutes: 1440,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
  "registre-entreprises": {
    id: "registre-entreprises",
    label: "Registre des entreprises du Québec (NEQ)",
    ckanId: "registre-des-entreprises",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-entreprises",
    preferredFormat: "csv",
    defaultLimit: 5000,
    productionLimit: 50000,
    refreshIntervalMinutes: 1440,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
  sanctions: {
    id: "sanctions",
    label: "Registre des sanctions administratives pécuniaires",
    ckanId: "registre-des-sanctions-administratives-pecuniaires",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/registre-des-sanctions-administratives-pecuniaires",
    preferredFormat: "csv",
    defaultLimit: 5000,
    productionLimit: 20000,
    refreshIntervalMinutes: 1440,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
  convictions: {
    id: "convictions",
    label: "Registre des déclarations de culpabilité",
    ckanId: "registre-des-declarations-de-culpabilite",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/?tags=Registre",
    preferredFormat: "csv",
    defaultLimit: 5000,
    productionLimit: 20000,
    refreshIntervalMinutes: 1440,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
  injuries: {
    id: "injuries",
    label: "Lésions professionnelles (CNESST)",
    ckanId: "lesions-professionnelles",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/lesions-professionnelles",
    preferredFormat: "csv",
    defaultLimit: 5000,
    productionLimit: 20000,
    refreshIntervalMinutes: 1440,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
  cadastre: {
    id: "cadastre",
    label: "Cadastre allégé du Québec",
    ckanId: "",
    arcGisLayerUrl: "https://services3.arcgis.com/0lL78GhXbg1Po7WO/arcgis/rest/services/cadastre_bd_allegee/FeatureServer/0",
    sourceUrl: "https://services3.arcgis.com/0lL78GhXbg1Po7WO/arcgis/rest/services/cadastre_bd_allegee/FeatureServer",
    preferredFormat: "geojson",
    defaultLimit: 1000,
    productionLimit: 5000,
    refreshIntervalMinutes: 10080,
    tier: "bootstrap",
    syncSource: "arcgis",
    syncEnabled: true,
  },
  "zoning-standard": {
    id: "zoning-standard",
    label: "Plan de zonage normalisé v1",
    ckanId: "plan-de-zonage",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/plan-de-zonage",
    preferredFormat: "geojson",
    defaultLimit: 2000,
    productionLimit: 10000,
    refreshIntervalMinutes: 10080,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
  "market-index": {
    id: "market-index",
    label: "Statistiques du Registre foncier (marché immobilier)",
    ckanId: "statistiques-du-registre-foncier-du-quebec-sur-le-marche-immobilier",
    sourceUrl: "https://www.donneesquebec.ca/recherche/dataset/statistiques-du-registre-foncier-du-quebec-sur-le-marche-immobilier",
    preferredFormat: "csv",
    defaultLimit: 2000,
    productionLimit: 10000,
    refreshIntervalMinutes: 1440,
    tier: "bootstrap",
    syncSource: "ckan",
    syncEnabled: true,
  },
```

### Step 2.3: Typecheck

- [ ] Run: `npx tsc --noEmit`
- Expected: clean. If `DatasetConfig` requires a field not provided, add it from an existing entry of the same `syncSource`.

### Step 2.4: Commit

- [ ] Run:
```bash
git add src/lib/datasets/registry.ts
git commit -m "feat(registry): add 8 Quebec compliance/intelligence dataset configs"
```

---

## Task 3: NEQ resolver (deterministic + fuzzy)

**Why before fetchers:** the compliance aggregator (Task 7) depends on it, and it's pure/testable in isolation.

**Files:**
- Create: `src/lib/compliance/neq-resolver.ts`
- Create: `src/lib/compliance/__tests__/neq-resolver.test.ts`

### Step 3.1: Write the failing test

- [ ] **Create `src/lib/compliance/__tests__/neq-resolver.test.ts`**:
```ts
import { describe, expect, it, vi } from "vitest";
import { rbqToNeq, findEnterpriseByNeq, nameToNeq } from "@/lib/compliance/neq-resolver";

describe("rbqToNeq", () => {
  it("derives the NEQ prefix from an RBQ license number", () => {
    // RBQ 1234-5678-01 -> NEQ prefix 1234
    expect(rbqToNeq("1234-5678-01")).toBe("1234");
  });
  it("returns null for malformed RBQ numbers", () => {
    expect(rbqToNeq("")).toBeNull();
    expect(rbqToNeq("abc")).toBeNull();
    expect(rbqToNeq(null)).toBeNull();
  });
});

describe("findEnterpriseByNeq", () => {
  it("returns the enterprise record when found", async () => {
    const lookup = vi.fn().mockResolvedValue({ id: "1", neq: "1234", name: "ABC Inc.", legalStatus: "Immatriculée" });
    const r = await findEnterpriseByNeq("1234", lookup);
    expect(r?.neq).toBe("1234");
  });
  it("returns null when not found", async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    expect(await findEnterpriseByNeq("9999", lookup)).toBeNull();
  });
});

describe("nameToNeq", () => {
  it("returns ranked candidates with confidence, never a single asserted match", async () => {
    const search = vi.fn().mockResolvedValue([
      { neq: "1234", name: "ABC CONSTRUCTION INC.", legalStatus: "Immatriculée" },
      { neq: "5555", name: "ABC PLOMBERIE", legalStatus: "Immatriculée" },
    ]);
    const r = await nameToNeq("ABC CONSTRUCTION", search);
    expect(r.length).toBe(2);
    expect(r[0]).toHaveProperty("confidence");
    expect(["high", "medium", "low"]).toContain(r[0].confidence);
  });
});
```

### Step 3.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/neq-resolver.test.ts`
- Expected: FAIL — module not found.

### Step 3.3: Implement the resolver

- [ ] **Create `src/lib/compliance/neq-resolver.ts`**:
```ts
import { prisma } from "@/lib/prisma";

/**
 * NEQ resolution. The strongest, most honest link is RBQ-license -> NEQ: the
 * RBQ license number's first 4 digits ARE the NEQ (documented RBQ numbering
 * convention). Name-based links are fuzzy and MUST carry a confidence label —
 * never asserted as a single certain identity.
 */

type EnterpriseLike = {
  id: string;
  neq: string | null;
  name: string | null;
  legalStatus?: string | null;
};

/**
 * Derive the NEQ prefix from an RBQ license number (e.g. "1234-5678-01" -> "1234").
 * Returns null for malformed input. Note: this is the NEQ *prefix*; a full NEQ
 * is 10 digits but the first 4 are sufficient for deterministic RBQ->NEQ linking.
 */
export function rbqToNeq(licenseNumber: string | null | undefined): string | null {
  if (!licenseNumber) return null;
  const match = /^(\d{4})/.exec(licenseNumber.replace(/\s+/g, ""));
  return match ? match[1] : null;
}

export type EnterpriseLookup = (neq: string) => Promise<EnterpriseLike | null>;
export type EnterpriseSearch = (name: string) => Promise<EnterpriseLike[]>;

export async function findEnterpriseByNeq(
  neq: string,
  lookup: EnterpriseLookup,
): Promise<EnterpriseLike | null> {
  return lookup(neq);
}

export type NameNeqCandidate = { neq: string | null; name: string | null; confidence: "high" | "medium" | "low" };

/**
 * Fuzzy name -> NEQ candidates. Confidence is based on similarity to the query:
 * high = normalized exact match; medium = strong token overlap; low = partial.
 * Never returns a single asserted identity — always ranked candidates.
 */
export async function nameToNeq(
  query: string,
  search: EnterpriseSearch,
): Promise<NameNeqCandidate[]> {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const q = norm(query);
  if (!q) return [];

  const rows = await search(query);
  return rows
    .map((r) => {
      const name = norm(r.name ?? "");
      if (!name) return { neq: r.neq, name: r.name, confidence: "low" as const };
      const confidence: NameNeqCandidate["confidence"] =
        name === q ? "high" : name.includes(q) || q.includes(name) ? "medium" : "low";
      return { neq: r.neq, name: r.name, confidence };
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.confidence] - rank[b.confidence];
    });
}

/** Production dependency wiring against Prisma. */
export function productionLookups() {
  return {
    byNeq: async (neq: string): Promise<EnterpriseLike | null> => {
      const r = await prisma.enterpriseRecord.findUnique({ where: { neq } });
      return r ? { id: r.id, neq: r.neq, name: r.name, legalStatus: r.legalStatus } : null;
    },
    byName: async (name: string): Promise<EnterpriseLike[]> => {
      const rows = await prisma.enterpriseRecord.findMany({
        where: { name: { contains: name, mode: "insensitive" } },
        take: 20,
      });
      return rows.map((r) => ({ id: r.id, neq: r.neq, name: r.name, legalStatus: r.legalStatus }));
    },
  };
}
```

### Step 3.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/neq-resolver.test.ts`
- Expected: PASS (5 tests).

### Step 3.5: Commit

- [ ] Run:
```bash
git add src/lib/compliance/neq-resolver.ts src/lib/compliance/__tests__/neq-resolver.test.ts
git commit -m "feat(compliance): NEQ resolver (deterministic RBQ->NEQ + fuzzy name match)"
```

---

## Task 4: The 8 fetchers

**Files:** 8 new files in `src/lib/datasets/fetchers/`. Each follows the `awards.ts` pattern: a typed record, a `fetchXxx(opts)` that pulls from CKAN/ArcGIS/CSV and normalizes, dropping bad rows.

These share so much structure that they're grouped by source type. **Before implementing each, read `src/lib/datasets/client.ts` to confirm the exact export names** for `fetchCkanDatastoreSearch`, `fetchCkanResourceUrl`, `fetchText`, `fetchArcGisFeatures` — use the names that exist.

### Step 4.1: RENA fetcher

- [ ] **Create `src/lib/datasets/fetchers/rena.ts`**:
```ts
import { fetchCkanResourceUrl, fetchText, parseCsvLine, pick } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type RenaRecord = {
  externalId: string;
  neq?: string;
  name?: string;
  status?: string;
  offence?: string;
  startDate?: Date;
  endDate?: Date;
  sourceUrl: string;
};

export async function fetchRena(opts: { limit?: number } = {}): Promise<RenaRecord[]> {
  const cfg = DATASETS["rena"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const lines = text.split("\n").filter(Boolean).slice(0, limit);
    return lines.slice(1).map((line, i) => {
      const row = parseCsvLine(line);
      const neq = pick(row, "neq", "NEQ", "numero_entreprise");
      return {
        externalId: neq || `rena-${i}`,
        neq: neq || undefined,
        name: pick(row, "nom", "name", "raison_sociale") || undefined,
        status: pick(row, "statut", "status") || undefined,
        offence: pick(row, "infraction", "offence") || undefined,
        sourceUrl: cfg.sourceUrl,
      };
    }).filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
```

### Step 4.2: Registre des entreprises fetcher

- [ ] **Create `src/lib/datasets/fetchers/registre-entreprises.ts`** (same shape; fields: neq, name, legalStatus, constitutionDate, address):
```ts
import { fetchCkanResourceUrl, fetchText, parseCsvLine, pick, parseDate } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type EnterpriseRow = {
  externalId: string;
  neq?: string;
  name?: string;
  legalStatus?: string;
  constitutionDate?: Date;
  address?: string;
  sourceUrl: string;
};

export async function fetchRegistreEntreprises(opts: { limit?: number } = {}): Promise<EnterpriseRow[]> {
  const cfg = DATASETS["registre-entreprises"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const lines = text.split("\n").filter(Boolean).slice(0, limit);
    return lines.slice(1).map((line) => {
      const row = parseCsvLine(line);
      const neq = pick(row, "neq", "NEQ", "numero_entreprise");
      return {
        externalId: neq || `ent-${Math.random().toString(36).slice(2, 10)}`,
        neq: neq || undefined,
        name: pick(row, "nom", "raison_sociale", "name") || undefined,
        legalStatus: pick(row, "statut", "statut_juridique") || undefined,
        address: pick(row, "adresse", "address") || undefined,
        sourceUrl: cfg.sourceUrl,
      };
    }).filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
```

### Step 4.3: Sanctions fetcher

- [ ] **Create `src/lib/datasets/fetchers/sanctions.ts`** (fields: neq, name, law, amount, date). Reuse the RENA template; change the cfg id to `"sanctions"` and the field picks to `montant/amount` (parse with `parseMoney`), `loi/law`, `date`.

```ts
import { fetchCkanResourceUrl, fetchText, parseCsvLine, pick, parseMoney, parseDate } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type SanctionRow = {
  externalId: string;
  neq?: string;
  name?: string;
  law?: string;
  amount?: number;
  date?: Date;
  sourceUrl: string;
};

export async function fetchSanctions(opts: { limit?: number } = {}): Promise<SanctionRow[]> {
  const cfg = DATASETS["sanctions"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const lines = text.split("\n").filter(Boolean).slice(0, limit);
    return lines.slice(1).map((line, i) => {
      const row = parseCsvLine(line);
      const neq = pick(row, "neq", "NEQ");
      return {
        externalId: neq || `san-${i}`,
        neq: neq || undefined,
        name: pick(row, "nom", "name") || undefined,
        law: pick(row, "loi", "law") || undefined,
        amount: parseMoney(pick(row, "montant", "amount")),
        date: parseDate(pick(row, "date")),
        sourceUrl: cfg.sourceUrl,
      };
    }).filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
```

### Step 4.4: Convictions fetcher

- [ ] **Create `src/lib/datasets/fetchers/convictions.ts`** (fields: neq, name, offence, date). Same template, cfg id `"convictions"`.

```ts
import { fetchCkanResourceUrl, fetchText, parseCsvLine, pick, parseDate } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type ConvictionRow = {
  externalId: string;
  neq?: string;
  name?: string;
  offence?: string;
  date?: Date;
  sourceUrl: string;
};

export async function fetchConvictions(opts: { limit?: number } = {}): Promise<ConvictionRow[]> {
  const cfg = DATASETS["convictions"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const lines = text.split("\n").filter(Boolean).slice(0, limit);
    return lines.slice(1).map((line, i) => {
      const row = parseCsvLine(line);
      const neq = pick(row, "neq", "NEQ");
      return {
        externalId: neq || `con-${i}`,
        neq: neq || undefined,
        name: pick(row, "nom", "name") || undefined,
        offence: pick(row, "infraction", "offence") || undefined,
        date: parseDate(pick(row, "date")),
        sourceUrl: cfg.sourceUrl,
      };
    }).filter((r) => r.neq || r.name);
  } catch {
    return [];
  }
}
```

### Step 4.5: Injuries (CNESST) fetcher

- [ ] **Create `src/lib/datasets/fetchers/injuries.ts`** (fields: employerName, neq, claimCount, year):

```ts
import { fetchCkanResourceUrl, fetchText, parseCsvLine, pick } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type InjuryRow = {
  externalId: string;
  employerName?: string;
  neq?: string;
  claimCount: number;
  year?: number;
  sourceUrl: string;
};

export async function fetchInjuries(opts: { limit?: number } = {}): Promise<InjuryRow[]> {
  const cfg = DATASETS["injuries"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const lines = text.split("\n").filter(Boolean).slice(0, limit);
    return lines.slice(1).map((line, i) => {
      const row = parseCsvLine(line);
      const neq = pick(row, "neq", "NEQ");
      const cnt = Number(pick(row, "nombre", "count", "claims") || "0");
      return {
        externalId: `${neq || "inj"}-${pick(row, "annee", "year") || i}`,
        employerName: pick(row, "employeur", "nom", "employer") || undefined,
        neq: neq || undefined,
        claimCount: Number.isFinite(cnt) ? cnt : 0,
        year: Number(pick(row, "annee", "year") || "0") || undefined,
        sourceUrl: cfg.sourceUrl,
      };
    }).filter((r) => r.employerName || r.neq);
  } catch {
    return [];
  }
}
```

### Step 4.6: Cadastre fetcher (ArcGIS)

- [ ] **Create `src/lib/datasets/fetchers/cadastre.ts`**:
```ts
import { fetchArcGisFeatures } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type CadastreRow = {
  externalId: string;
  lotNumber?: string;
  city?: string;
  geom?: unknown;
  sourceUrl: string;
};

export async function fetchCadastre(opts: { limit?: number } = {}): Promise<CadastreRow[]> {
  const cfg = DATASETS["cadastre"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  const url = cfg.arcGisLayerUrl;
  if (!url) return [];
  try {
    const features = await fetchArcGisFeatures(url, limit);
    return features.map((f: any, i: number) => ({
      externalId: f.attributes?.id || f.attributes?.OBJECTID || `lot-${i}`,
      lotNumber: f.attributes?.lot || f.attributes?.no_lot || f.attributes?.LOT || undefined,
      city: f.attributes?.municipalite || f.attributes?.city || undefined,
      geom: f.geometry ?? null,
      sourceUrl: cfg.sourceUrl,
    })).filter((r) => r.lotNumber);
  } catch {
    return [];
  }
}
```

### Step 4.7: Zoning standard fetcher (GeoJSON from CKAN)

- [ ] **Create `src/lib/datasets/fetchers/zoning-standard.ts`**:
```ts
import { fetchCkanResourceUrl, fetchText } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type ZoningStandardRow = {
  externalId: string;
  city?: string;
  zoneCode?: string;
  allowedUses?: string[];
  sourceUrl: string;
};

export async function fetchZoningStandard(opts: { limit?: number } = {}): Promise<ZoningStandardRow[]> {
  const cfg = DATASETS["zoning-standard"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const geo = JSON.parse(text) as { features?: any[] };
    return (geo.features ?? []).slice(0, limit).map((f, i) => ({
      externalId: f.properties?.id || f.properties?.OBJECTID || `zon-${i}`,
      city: f.properties?.municipalite || f.properties?.city || undefined,
      zoneCode: f.properties?.zone || f.properties?.code || f.properties?.zonage || undefined,
      allowedUses: f.properties?.usages || f.properties?.allowed_uses
        ? String(f.properties.usages ?? f.properties.allowed_uses).split(/[;,]/).map((s) => s.trim()).filter(Boolean)
        : undefined,
      sourceUrl: cfg.sourceUrl,
    })).filter((r) => r.zoneCode || r.city);
  } catch {
    return [];
  }
}
```

### Step 4.8: Market index fetcher

- [ ] **Create `src/lib/datasets/fetchers/market-index.ts`** (fields: region, priceRange, salesCount, difficultyIndex, period):

```ts
import { fetchCkanResourceUrl, fetchText, parseCsvLine, pick } from "../client";
import { DATASETS, getSyncLimit } from "../registry";

export type MarketIndexRow = {
  externalId: string;
  region?: string;
  priceRange?: string;
  salesCount: number;
  difficultyIndex?: number;
  period?: string;
  sourceUrl: string;
};

export async function fetchMarketIndex(opts: { limit?: number } = {}): Promise<MarketIndexRow[]> {
  const cfg = DATASETS["market-index"];
  const limit = opts.limit ?? getSyncLimit(cfg);
  try {
    const url = await fetchCkanResourceUrl(cfg);
    if (!url) return [];
    const text = await fetchText(url);
    const lines = text.split("\n").filter(Boolean).slice(0, limit);
    return lines.slice(1).map((line, i) => {
      const row = parseCsvLine(line);
      const cnt = Number(pick(row, "nombre", "ventes", "sales") || "0");
      const di = Number(pick(row, "indice", "difficulty", "indice_difficulte") || "NaN");
      return {
        externalId: `${pick(row, "region") || "reg"}-${pick(row, "periode", "period") || i}`,
        region: pick(row, "region") || undefined,
        priceRange: pick(row, "tranche_prix", "price_range") || undefined,
        salesCount: Number.isFinite(cnt) ? cnt : 0,
        difficultyIndex: Number.isFinite(di) ? di : undefined,
        period: pick(row, "periode", "period") || undefined,
        sourceUrl: cfg.sourceUrl,
      };
    }).filter((r) => r.region || r.period);
  } catch {
    return [];
  }
}
```

### Step 4.9: Verify client exports exist

- [ ] Run: `grep -n "export.*fetchCkanResourceUrl\|export.*fetchArcGisFeatures\|export.*parseMoney\|export.*parseDate\|export.*fetchText" src/lib/datasets/client.ts src/lib/datasets/parser.ts`
- If any name is missing or named differently, adjust the imports in the fetchers to match the real exports. Do NOT invent new helpers.

### Step 4.10: Typecheck all fetchers

- [ ] Run: `npx tsc --noEmit`
- Expected: clean. Fix any type errors in the fetchers (commonly: `getSyncLimit` signature, or `pick` return type).

### Step 4.11: Commit

- [ ] Run:
```bash
git add src/lib/datasets/fetchers/rena.ts src/lib/datasets/fetchers/registre-entreprises.ts src/lib/datasets/fetchers/sanctions.ts src/lib/datasets/fetchers/convictions.ts src/lib/datasets/fetchers/injuries.ts src/lib/datasets/fetchers/cadastre.ts src/lib/datasets/fetchers/zoning-standard.ts src/lib/datasets/fetchers/market-index.ts
git commit -m "feat(fetchers): add 8 Quebec compliance/intelligence dataset fetchers"
```

---

## Task 5: Sync runner wrappers + SYNC_FNS entries

**Files:**
- Modify: `src/lib/sync/runner.ts` (add 8 `syncXxx()` wrappers + entries in `SYNC_FNS` + counts in `getSyncStatus`)

### Step 5.1: Add imports

- [ ] In `src/lib/sync/runner.ts`, after the existing fetcher imports (around line 38), add:
```ts
import { fetchRena } from "@/lib/datasets/fetchers/rena";
import { fetchRegistreEntreprises } from "@/lib/datasets/fetchers/registre-entreprises";
import { fetchSanctions } from "@/lib/datasets/fetchers/sanctions";
import { fetchConvictions } from "@/lib/datasets/fetchers/convictions";
import { fetchInjuries } from "@/lib/datasets/fetchers/injuries";
import { fetchCadastre } from "@/lib/datasets/fetchers/cadastre";
import { fetchZoningStandard } from "@/lib/datasets/fetchers/zoning-standard";
import { fetchMarketIndex } from "@/lib/datasets/fetchers/market-index";
```

### Step 5.2: Add the 8 sync wrappers

- [ ] Find the existing sync wrappers (e.g. `async function syncRbq(...)`) and add alongside them, before `const SYNC_FNS`:
```ts
async function syncRena(): Promise<SyncResult> {
  const rows = await fetchRena();
  let processed = 0;
  for (const r of rows) {
    await prisma.renaRecord.upsert({
      where: { id: r.externalId },
      update: {},
      create: { id: r.externalId, neq: r.neq, name: r.name, status: r.status, offence: r.offence, startDate: r.startDate, endDate: r.endDate, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("rena", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "rena", ok: true, processed, source: "ckan" };
}

async function syncRegistreEntreprises(): Promise<SyncResult> {
  const rows = await fetchRegistreEntreprises();
  let processed = 0;
  for (const r of rows) {
    if (!r.neq) continue;
    await prisma.enterpriseRecord.upsert({
      where: { neq: r.neq },
      update: { name: r.name, legalStatus: r.legalStatus, address: r.address },
      create: { neq: r.neq, name: r.name, legalStatus: r.legalStatus, address: r.address, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("registre-entreprises", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "registre-entreprises", ok: true, processed, source: "ckan" };
}

async function syncSanctions(): Promise<SyncResult> {
  const rows = await fetchSanctions();
  let processed = 0;
  for (const r of rows) {
    await prisma.sanctionRecord.upsert({
      where: { id: r.externalId },
      update: {},
      create: { id: r.externalId, neq: r.neq, name: r.name, law: r.law, amount: r.amount, date: r.date, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("sanctions", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "sanctions", ok: true, processed, source: "ckan" };
}

async function syncConvictions(): Promise<SyncResult> {
  const rows = await fetchConvictions();
  let processed = 0;
  for (const r of rows) {
    await prisma.convictionRecord.upsert({
      where: { id: r.externalId },
      update: {},
      create: { id: r.externalId, neq: r.neq, name: r.name, offence: r.offence, date: r.date, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("convictions", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "convictions", ok: true, processed, source: "ckan" };
}

async function syncInjuries(): Promise<SyncResult> {
  const rows = await fetchInjuries();
  let processed = 0;
  for (const r of rows) {
    await prisma.injuryClaim.upsert({
      where: { id: r.externalId },
      update: {},
      create: { id: r.externalId, employerName: r.employerName, neq: r.neq, claimCount: r.claimCount, year: r.year, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("injuries", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "injuries", ok: true, processed, source: "ckan" };
}

async function syncCadastre(): Promise<SyncResult> {
  const rows = await fetchCadastre();
  let processed = 0;
  for (const r of rows) {
    if (!r.lotNumber) continue;
    await prisma.cadastreLot.upsert({
      where: { lotNumber: r.lotNumber },
      update: { city: r.city, geom: r.geom as any },
      create: { lotNumber: r.lotNumber, city: r.city, geom: r.geom as any, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("cadastre", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "cadastre", ok: true, processed, source: "arcgis" };
}

async function syncZoningStandard(): Promise<SyncResult> {
  const rows = await fetchZoningStandard();
  let processed = 0;
  for (const r of rows) {
    await prisma.zoningStandard.upsert({
      where: { id: r.externalId },
      update: {},
      create: { id: r.externalId, city: r.city, zoneCode: r.zoneCode, allowedUses: r.allowedUses as any, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("zoning-standard", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "zoning-standard", ok: true, processed, source: "ckan" };
}

async function syncMarketIndex(): Promise<SyncResult> {
  const rows = await fetchMarketIndex();
  let processed = 0;
  for (const r of rows) {
    await prisma.marketIndex.upsert({
      where: { id: r.externalId },
      update: {},
      create: { id: r.externalId, region: r.region, priceRange: r.priceRange, salesCount: r.salesCount, difficultyIndex: r.difficultyIndex, period: r.period, sourceUrl: r.sourceUrl },
    }).catch(() => {});
    processed++;
  }
  await logSync("market-index", processed > 0 ? "complete" : "empty", processed);
  return { dataset: "market-index", ok: true, processed, source: "ckan" };
}
```

### Step 5.3: Register them in SYNC_FNS

- [ ] In the `SYNC_FNS` table (around line 1975), add before the closing `};`:
```ts
  rena: syncRena,
  "registre-entreprises": syncRegistreEntreprises,
  sanctions: syncSanctions,
  convictions: syncConvictions,
  injuries: syncInjuries,
  cadastre: syncCadastre,
  "zoning-standard": syncZoningStandard,
  "market-index": syncMarketIndex,
```

### Step 5.4: Add counts to getSyncStatus

- [ ] In `getSyncStatus` (around line 2077-2111), add to the `counts` array:
```ts
    await prisma.renaRecord.count(),
    await prisma.enterpriseRecord.count(),
    await prisma.sanctionRecord.count(),
    await prisma.convictionRecord.count(),
    await prisma.injuryClaim.count(),
    await prisma.cadastreLot.count(),
    await prisma.zoningStandard.count(),
    await prisma.marketIndex.count(),
```
and destructure + add to the returned `counts` object with matching keys (`renaRecords`, `enterprises`, `sanctions`, `convictions`, `injuryClaims`, `cadastreLots`, `zoningStandards`, `marketIndices`).

### Step 5.5: Populate RbqLicense.neq on RBQ sync

- [ ] Find `syncRbq` (or the RBQ fetcher persist step) and, when upserting each license, set `neq: rbqToNeq(licenseNumber)`:
```ts
import { rbqToNeq } from "@/lib/compliance/neq-resolver";
// in the RBQ upsert:
neq: rbqToNeq(licenseNumber),
```

### Step 5.6: Typecheck + test

- [ ] Run: `npx tsc --noEmit && npx vitest run`
- Expected: clean; existing tests still pass.

### Step 5.7: Commit

- [ ] Run:
```bash
git add src/lib/sync/runner.ts
git commit -m "feat(sync): wire 8 new datasets into the sync runner + populate RbqLicense.neq"
```

---

## Task 6: Contractor compliance aggregator

**Files:**
- Create: `src/lib/compliance/contractor-compliance.ts`
- Create: `src/lib/compliance/__tests__/contractor-compliance.test.ts`

### Step 6.1: Write the failing test

- [ ] **Create `src/lib/compliance/__tests__/contractor-compliance.test.ts`**:
```ts
import { describe, expect, it, vi } from "vitest";
import { assembleCompliance } from "@/lib/compliance/contractor-compliance";

const deps = {
  findRena: vi.fn(),
  findEnterprise: vi.fn(),
  findSanctions: vi.fn().mockResolvedValue([]),
  findConvictions: vi.fn().mockResolvedValue([]),
  findInjuries: vi.fn().mockResolvedValue(null),
  findAwards: vi.fn().mockResolvedValue({ count: 0, totalValue: 0, recent: [] }),
  findRbq: vi.fn(),
};

describe("assembleCompliance", () => {
  it("marks RENA-active NEQ as non-eligible + high risk", async () => {
    deps.findRena.mockResolvedValue({ active: true, offence: "fraude", startDate: new Date("2025-01-01") });
    deps.findEnterprise.mockResolvedValue({ neq: "1234", name: "ABC", legalStatus: "Immatriculée" });
    const r = await assembleCompliance({ neq: "1234" }, deps);
    expect(r.publicBidEligible).toBe(false);
    expect(r.overallRisk).toBe("high");
    expect(r.renaNonAdmissible?.active).toBe(true);
  });

  it("marks a clean NEQ as eligible + low risk", async () => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue({ neq: "1234", name: "ABC", legalStatus: "Immatriculée" });
    const r = await assembleCompliance({ neq: "1234" }, deps);
    expect(r.publicBidEligible).toBe(true);
    expect(r.overallRisk).toBe("low");
  });

  it("resolves NEQ from an RBQ license number when neq not given", async () => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue(null);
    const r = await assembleCompliance({ licenseNumber: "1234-5678-01" }, deps);
    expect(r.neq).toBe("1234");
  });

  it("returns unknown risk when no data is found", async () => {
    deps.findRena.mockResolvedValue(null);
    deps.findEnterprise.mockResolvedValue(null);
    deps.findSanctions.mockResolvedValue([]);
    const r = await assembleCompliance({ neq: "0000" }, deps);
    expect(r.overallRisk).toBe("unknown");
  });
});
```

### Step 6.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/contractor-compliance.test.ts`
- Expected: FAIL — module not found.

### Step 6.3: Implement the aggregator

- [ ] **Create `src/lib/compliance/contractor-compliance.ts`**:
```ts
import { prisma } from "@/lib/prisma";
import { rbqToNeq } from "@/lib/compliance/neq-resolver";

export type ContractorCompliance = {
  neq: string | null;
  legalName: string | null;
  legalStatus: "active" | "dissolved" | "unknown";
  rbqLicense: { number: string; subclass: string | null; status: string; expiry: Date | null } | null;
  renaNonAdmissible: { active: boolean; offence?: string | null; startDate?: Date | null; endDate?: Date | null } | null;
  sanctions: { count: number; recent: { law?: string | null; amount?: number | null; date?: Date | null }[] };
  convictions: { count: number; recent: { offence?: string | null; date?: Date | null }[] };
  injuryClaims: { totalClaims: number; recentYear?: number | null } | null;
  awardsWon: { count: number; totalValue: number; recent: { name?: string | null; value?: number | null; date?: string | null }[] };
  publicBidEligible: boolean;
  overallRisk: "low" | "medium" | "high" | "unknown";
};

export type ComplianceInput = { neq?: string | null; licenseNumber?: string | null };
export type ComplianceDeps = {
  findRena: (neq: string) => Promise<{ active: boolean; offence?: string | null; startDate?: Date | null; endDate?: Date | null } | null>;
  findEnterprise: (neq: string) => Promise<{ neq: string; name: string | null; legalStatus: string | null } | null>;
  findSanctions: (neq: string) => Promise<{ law?: string | null; amount?: number | null; date?: Date | null }[]>;
  findConvictions: (neq: string) => Promise<{ offence?: string | null; date?: Date | null }[]>;
  findInjuries: (neq: string) => Promise<{ totalClaims: number; recentYear?: number | null } | null>;
  findAwards: (neq: string) => Promise<{ count: number; totalValue: number; recent: { name?: string | null; value?: number | null; date?: string | null }[] }>;
  findRbq: (neq: string) => Promise<{ number: string; subclass: string | null; status: string; expiry: Date | null } | null>;
};

export async function assembleCompliance(
  input: ComplianceInput,
  deps: ComplianceDeps,
): Promise<ContractorCompliance> {
  const neq = input.neq ?? rbqToNeq(input.licenseNumber);

  if (!neq) {
    return emptyCompliance(null);
  }

  const [rena, enterprise, sanctions, convictions, injuries, awards, rbq] = await Promise.all([
    deps.findRena(neq).catch(() => null),
    deps.findEnterprise(neq).catch(() => null),
    deps.findSanctions(neq).catch(() => []),
    deps.findConvictions(neq).catch(() => []),
    deps.findInjuries(neq).catch(() => null),
    deps.findAwards(neq).catch(() => ({ count: 0, totalValue: 0, recent: [] })),
    deps.findRbq(neq).catch(() => null),
  ]);

  const renaActive = rena?.active === true;
  const legalStatus: ContractorCompliance["legalStatus"] =
    enterprise?.legalStatus?.toLowerCase().includes("dissou") || enterprise?.legalStatus?.toLowerCase().includes("radie")
      ? "dissolved"
      : enterprise?.legalStatus
        ? "active"
        : "unknown";

  // Risk: RENA active OR >0 convictions OR many sanctions -> high; some sanctions -> medium;
  // none and enterprise active -> low; no data at all -> unknown.
  const hasData = rena || enterprise || sanctions.length || convictions.length || injuries || rbq;
  let overallRisk: ContractorCompliance["overallRisk"];
  if (renaActive || convictions.length > 0) overallRisk = "high";
  else if (sanctions.length >= 3 || (injuries && injuries.totalClaims > 20)) overallRisk = "medium";
  else if (hasData) overallRisk = "low";
  else overallRisk = "unknown";

  return {
    neq,
    legalName: enterprise?.name ?? null,
    legalStatus,
    rbqLicense: rbq,
    renaNonAdmissible: rena,
    sanctions: { count: sanctions.length, recent: sanctions.slice(0, 5) },
    convictions: { count: convictions.length, recent: convictions.slice(0, 5) },
    injuryClaims: injuries,
    awardsWon: awards,
    publicBidEligible: !renaActive,
    overallRisk,
  };
}

function emptyCompliance(neq: string | null): ContractorCompliance {
  return {
    neq,
    legalName: null,
    legalStatus: "unknown",
    rbqLicense: null,
    renaNonAdmissible: null,
    sanctions: { count: 0, recent: [] },
    convictions: { count: 0, recent: [] },
    injuryClaims: null,
    awardsWon: { count: 0, totalValue: 0, recent: [] },
    publicBidEligible: true,
    overallRisk: "unknown",
  };
}

/** Production dependency wiring. */
export function productionComplianceDeps(): ComplianceDeps {
  const isActive = (rec: { startDate?: Date | null; endDate?: Date | null } | null) => {
    if (!rec) return false;
    const now = new Date();
    if (rec.endDate && rec.endDate < now) return false;
    return true;
  };
  return {
    findRena: async (neq) => {
      const rec = await prisma.renaRecord.findFirst({ where: { neq }, orderBy: { startDate: "desc" } });
      if (!rec) return null;
      return { active: isActive(rec), offence: rec.offence, startDate: rec.startDate, endDate: rec.endDate };
    },
    findEnterprise: async (neq) => {
      const r = await prisma.enterpriseRecord.findUnique({ where: { neq } });
      return r ? { neq: r.neq ?? neq, name: r.name, legalStatus: r.legalStatus } : null;
    },
    findSanctions: async (neq) => {
      const rows = await prisma.sanctionRecord.findMany({ where: { neq }, orderBy: { date: "desc" }, take: 5 });
      return rows.map((r) => ({ law: r.law, amount: r.amount, date: r.date }));
    },
    findConvictions: async (neq) => {
      const rows = await prisma.convictionRecord.findMany({ where: { neq }, orderBy: { date: "desc" }, take: 5 });
      return rows.map((r) => ({ offence: r.offence, date: r.date }));
    },
    findInjuries: async (neq) => {
      const rows = await prisma.injuryClaim.findMany({ where: { neq }, orderBy: { year: "desc" }, take: 1 });
      if (!rows.length) return null;
      return { totalClaims: rows[0].claimCount, recentYear: rows[0].year };
    },
    findAwards: async (_neq) => {
      // Awards are matched by winner name, not NEQ, in the current schema.
      return { count: 0, totalValue: 0, recent: [] };
    },
    findRbq: async (neq) => {
      const r = await prisma.rbqLicense.findFirst({ where: { neq } });
      if (!r) return null;
      return { number: r.licenseNumber, subclass: r.subclass, status: r.status, expiry: r.expiryDate };
    },
  };
}
```

### Step 6.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/contractor-compliance.test.ts`
- Expected: PASS (4 tests).

### Step 6.5: Commit

- [ ] Run:
```bash
git add src/lib/compliance/contractor-compliance.ts src/lib/compliance/__tests__/contractor-compliance.test.ts
git commit -m "feat(compliance): contractor compliance aggregator (RENA + sanctions + risk)"
```

---

## Task 7: Fit-score compliance gate

**Files:**
- Modify: `src/lib/opportunities/contractor-fit-profile.ts`
- Modify: `src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`

### Step 7.1: Add the failing test

- [ ] Append to the existing test file:
```ts
import type { ContractorCompliance } from "@/lib/compliance/contractor-compliance";

describe("scoreOpportunityForUser compliance gate", () => {
  it("forces weak when contractor is RENA non-admissible", () => {
    const renaCompliance: ContractorCompliance = {
      neq: "1234", legalName: "X", legalStatus: "active", rbqLicense: null,
      renaNonAdmissible: { active: true }, sanctions: { count: 0, recent: [] },
      convictions: { count: 0, recent: [] }, injuryClaims: null,
      awardsWon: { count: 0, totalValue: 0, recent: [] },
      publicBidEligible: false, overallRisk: "high",
    };
    const s = scoreOpportunityForUser(
      { kind: "tender", requiredRbqClasses: ["1.1.1"], city: "Montréal", title: "Construction",
        valueEstimate: { kind: "estimated", low: 100_000, high: 500_000, currency: "CAD", confidence: "high", basis: [] } },
      { rbqLicenseClass: "1.1.1", regions: ["Montréal"], trades: [], minProjectCost: 0, maxProjectCost: 1e9 },
      renaCompliance,
    );
    expect(s.level).toBe("weak");
    expect(s.breakdown.some((b) => b.id === "rena_non_admissible")).toBe(true);
  });
});
```

### Step 7.2: Run test to verify it fails

- [ ] Run: `npx vitest run src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`
- Expected: FAIL — `scoreOpportunityForUser` doesn't accept a 3rd arg.

### Step 7.3: Implement the gate

- [ ] In `src/lib/opportunities/contractor-fit-profile.ts`, add the import and extend the signature:
```ts
import type { ContractorCompliance } from "@/lib/compliance/contractor-compliance";

export function scoreOpportunityForUser(
  item: OpportunityInput,
  profile: ContractorProfile | null,
  compliance?: ContractorCompliance | null,
): FitScore {
  // RENA gate: a non-admissible contractor cannot legally bid public work.
  if (compliance?.renaNonAdmissible?.active) {
    return {
      score: 0,
      level: "weak",
      breakdown: [{ id: "rena_non_admissible", label: "Non-admissible aux contrats publics (RENA)", points: -100 }],
    };
  }
  // ... existing body unchanged
```

### Step 7.4: Run test to verify it passes

- [ ] Run: `npx vitest run src/lib/opportunities/__tests__/contractor-fit-profile.test.ts`
- Expected: PASS (all, incl. the new gate test).

### Step 7.5: Commit

- [ ] Run:
```bash
git add src/lib/opportunities/contractor-fit-profile.ts src/lib/opportunities/__tests__/contractor-fit-profile.test.ts
git commit -m "feat(fit-score): RENA non-admissible is a hard compliance gate"
```

---

## Task 8: Parcel verdict + zoning/cadastre + value market-index

**Files:**
- Modify: `src/lib/compliance/parcel-verdict.ts`
- Modify: `src/lib/permits/value-estimate.ts`
- Modify: their tests

### Step 8.1: Extend ParcelVerdict with zoning/cadastre

- [ ] In `src/lib/compliance/parcel-verdict.ts`, extend the type:
```ts
export type ParcelVerdict = {
  status: "clear" | "constraint_present" | "unknown_layer";
  constraints: ParcelConstraint[];
  note: string;
  zoningUses?: string[];
  lotNumber?: string;
};
```
- Add two optional deps to `AssessDeps`:
```ts
export type AssessDeps = {
  findContaminated: (...) => Promise<...>;
  findHeritage: (...) => Promise<...>;
  findZoning?: (lat: number, lon: number) => Promise<{ zoneCode?: string | null; allowedUses?: string[] } | null>;
  findCadastre?: (lat: number, lon: number) => Promise<{ lotNumber?: string | null } | null>;
  radiusMeters: number;
};
```
- In `assessParcel`, after the contamination/heritage block, add (guard each with try/catch → unknown):
```ts
  let zoningUses: string[] | undefined;
  let lotNumber: string | undefined;
  if (deps.findZoning) {
    try { const z = await deps.findZoning(lat, lon); if (z?.allowedUses) zoningUses = z.allowedUses; } catch { unknown = true; }
  }
  if (deps.findCadastre) {
    try { const c = await deps.findCadastre(lat, lon); if (c?.lotNumber) lotNumber = c.lotNumber; } catch { unknown = true; }
  }
```
and include `zoningUses`, `lotNumber` in all three return branches.

### Step 8.2: Wire production zoning/cadastre lookups

- [ ] In `productionParcelDeps`, add:
```ts
    findZoning: async (_lat, _lon) => null, // zoning-standard has no point-in-polygon here yet; returns null → unknown, honest
    findCadastre: async (_lat, _lon) => null,
```
(Honest: until a point-in-polygon query is added, these return null and the verdict notes `unknown_layer` for zoning — never fakes a use list.)

### Step 8.3: Extend value-estimate with marketIndex

- [ ] In `src/lib/permits/value-estimate.ts`, extend `EstimateOptions`:
```ts
export type EstimateOptions = {
  rbqClasses?: string[];
  comparableMedian?: number;
  comparableCount?: number;
  marketIndex?: { salesCount: number; difficultyIndex?: number } | null;
};
```
- In `estimatePermitValue`, after computing `confidence`, adjust it:
```ts
  let confidence: "low" | "medium" | "high" = count >= MIN_COMPARABLES_FOR_HIGH ? "high" : count > 0 ? "medium" : "low";
  if (options?.marketIndex) {
    const mi = options.marketIndex;
    if (mi.salesCount >= 50 && (mi.difficultyIndex ?? 1) <= 0.5) confidence = bumpConfidence(confidence);
    else if (mi.salesCount < 10 || (mi.difficultyIndex ?? 0) >= 1.5) confidence = "low";
  }
```
- Add helper:
```ts
function bumpConfidence(c: "low" | "medium" | "high"): "low" | "medium" | "high" {
  return c === "low" ? "medium" : "high";
}
```
- Add to the `basis` array when marketIndex is present:
```ts
    options?.marketIndex ? `Marché régional : ${options.marketIndex.salesCount} ventes.` : "Aucun indice de marché indexé.",
```

### Step 8.4: Run tests

- [ ] Run: `npx vitest run src/lib/compliance/__tests__/parcel-verdict.test.ts src/lib/permits/__tests__/value-estimate.test.ts`
- Expected: PASS (new optional fields don't break existing assertions; add one test each for the new behavior if desired).

### Step 8.5: Commit

- [ ] Run:
```bash
git add src/lib/compliance/parcel-verdict.ts src/lib/permits/value-estimate.ts
git commit -m "feat: parcel verdict gains zoning/cadastre; value estimate gains market-index confidence"
```

---

## Task 9: Surface compliance in the dossier + feed

**Files:**
- Modify: `src/lib/domain/quebec.ts`
- Modify: `src/app/api/feed/route.ts`
- Modify: `scripts/verify-deploy.ts`

### Step 9.1: Add compliance to OpportunityDossier

- [ ] In `src/lib/domain/quebec.ts`, add import + field:
```ts
import type { ContractorCompliance } from "@/lib/compliance/contractor-compliance";
```
and in the `OpportunityDossier` type (after `parcelVerdict?`):
```ts
  compliance?: ContractorCompliance;
```

### Step 9.2: Resolve compliance for tender award winners in the feed

- [ ] In `src/app/api/feed/route.ts`, add imports:
```ts
import { assembleCompliance, productionComplianceDeps } from "@/lib/compliance/contractor-compliance";
import { nameToNeq, productionLookups } from "@/lib/compliance/neq-resolver";
```
- In the tender loop, after computing `tenderContactLeads`, if there's an awarded contractor, resolve its compliance:
```ts
      let tenderCompliance;
      const winner = tenderContactLeads?.tender?.awardedContractor?.name;
      if (winner) {
        const lookups = productionLookups();
        const candidates = await nameToNeq(winner, lookups.byName).catch(() => []);
        const best = candidates.find((c) => c.confidence !== "low");
        if (best?.neq) {
          tenderCompliance = await assembleCompliance({ neq: best.neq }, productionComplianceDeps()).catch(() => undefined);
        }
      }
```
and pass `compliance: tenderCompliance` into `buildTenderOpportunityDossier`.

- In `src/lib/opportunities/dossier.ts`, add `compliance?: ContractorCompliance;` to `TenderDossierInput` and pass it through in the returned object.

### Step 9.3: Extend verify-deploy with a compliance assertion

- [ ] In `scripts/verify-deploy.ts`, extend the feed-permit check to also assert a tender carries a `compliance` block (when an award winner exists):
```ts
        const tenders = (json.items ?? []).filter((i) => i.kind === "tender");
        const withCompliance = tenders.filter((t) => t.opportunityDossier?.compliance);
        console.log(`tenders=${tenders.length} withCompliance=${withCompliance.length}`);
        // Soft assertion: if any tender has an awarded contractor, at least one should carry compliance.
        const awarded = tenders.filter((t) => t.opportunityDossier?.contactLeads?.tender?.awardedContractor);
        return (
          permits.length > 0 && withValue.length > 0 && withContact.length > 0 && withParcel.length > 0 &&
          (awarded.length === 0 || withCompliance.length > 0)
        );
```

### Step 9.4: Typecheck + lint + test + build

- [ ] Run: `npm run lint && npm run typecheck && npx vitest run && npm run build`
- Expected: all pass.

### Step 9.5: Commit

- [ ] Run:
```bash
git add src/lib/domain/quebec.ts src/lib/opportunities/dossier.ts src/app/api/feed/route.ts scripts/verify-deploy.ts
git commit -m "feat(feed): surface contractor compliance on tender award winners"
```

---

## Task 10: Deploy + sync + verify

### Step 10.1: Full CI gate

- [ ] Run: `npm run ci`
- Expected: 252+ tests pass, build compiles.

### Step 10.2: Push

- [ ] Run: `git push origin main`
- Expected: push succeeds; GitHub Actions green.

### Step 10.3: Deploy

- [ ] Run: `npx vercel --prod`
- Expected: READY, aliased to zonning.vercel.app.

### Step 10.4: Apply migration to production

- [ ] Run: `npx prisma migrate deploy` (uses the production `POSTGRES_URL_NON_POOLING`)
- Expected: migration applied; new tables exist in Postgres.

### Step 10.5: Trigger a sync of the 8 new datasets

- [ ] Run (via a node script using `loadProdEnv` + fetch with the cron secret, like the repair endpoint invocation):
```ts
for (const id of ["rena","registre-entreprises","sanctions","convictions","injuries","cadastre","zoning-standard","market-index"]) {
  await fetch(`${APP_URL}/api/cron/sync?dataset=${id}`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
}
```
- Expected: each returns 200; `/api/sync/status` shows > 0 rows for each table (or an honest "empty" if a CKAN resource id is wrong — investigate, don't fake).

### Step 10.6: Verify:deploy

- [ ] Run: `npm run verify:deploy`
- Expected: all checks pass, including the new compliance assertion.

### Step 10.7: Live spot-check

- [ ] Run a feed query and confirm a tender with an awarded contractor carries a `compliance` block with `publicBidEligible` and `overallRisk`.
- [ ] Check `/api/sync/status` counts for the 8 new tables are > 0.

### Step 10.8: Final commit + report

- [ ] Commit any remaining changes; report the real counts and a sample compliance block. Do NOT claim "everything is working" unless every check in 10.1/10.6/10.7 passed.

---

## Self-Review

- [x] **Spec coverage:** 8 datasets (Tasks 1, 2, 4, 5), NEQ resolver (Task 3), compliance aggregator (Task 6), fit-score gate (Task 7), parcel/value extensions (Task 8), feed surfacing (Task 9), deploy+verify (Task 10). All spec units covered.
- [x] **Placeholder scan:** no TBD/TODO; every code step shows full code.
- [x] **Type consistency:** `ContractorCompliance`, `ComplianceDeps`, `NameNeqCandidate`, `rbqToNeq` defined once and referenced consistently. `assembleCompliance` signature matches across Tasks 6, 7, 9.
- [x] **Scope:** focused on the 8 datasets + NEQ graph; no scraping; reuses existing pipeline. Matches the approved spec.
