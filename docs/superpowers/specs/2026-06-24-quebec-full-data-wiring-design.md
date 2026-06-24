# Quebec Full Data Wiring + NEQ Intelligence Graph (Design)

Date: 2026-06-24
Status: Spec (pending user review)
Owner: contractor intelligence

## Why this exists

The operator wants every available Quebec open dataset wired and the app made
genuinely stronger. A full discovery pass against donneesquebec.ca,
ouvert.canada.ca, SEAO, and CanadaBuys (see discovery notes below) shows the
registry already covers 68 datasets across permits, tenders/SEAO, awards, RBQ
licenses + infractions, contamination (GTC + provincial), heritage, zoning,
flood, wetlands, assessment rolls, transactions, roadworks, suppliers, CNESST
stats, CPTAQ, and PUM2050.

The remaining **8 high-value, machine-readable, untapped datasets** are the real
gap. Wiring them as standalone tables (approach B) adds rows but repeats the
"a list of datasets" pattern that made the app feel weak. Wiring them AND
linking by NEQ (approach A — approved) turns disconnected records into a single
verified contractor dossier with compliance, safety, and win-history. That is
the "intelligence OS" strength the operator wants.

## Discovery — what exists vs what's wired

Already wired (68): permits (MTL/Laval/Québec), tenders, awards, canadabuys,
seao-standing-offers, suppliers, rbq, rbq-infractions, contamination,
contamination-gtc, gtc-provincial, heritage, heritage-eip, heritage-lpc,
flood-hazards, wetlands-provincial, protected-areas, cptaq-zones,
cptaq-decisions, zoning (+ per-city), pum2050-*, assessment, mamh-assessment-rolls,
mamh-municipal-directory, transactions, transactions-2023, transactions-2025,
taxes, roadworks, roadworks-saguenay, inspection-violations-mtl, contracts,
contracts-boroughs, amp-registry, cnesst, registre, permit-delays, permit-stats,
adresses-quebec, road-network, projects-*.

**Untapped and high-value (this spec):**

| # | Dataset | Source | Adds |
|---|---------|--------|------|
| 1 | RENA — entreprises non-admissibles aux contrats publics | donneesquebec `registre-des-entreprises-non-admissibles-aux-contrats-publics-rena` | compliance gate (cannot bid public work) |
| 2 | Registre des entreprises (NEQ) | donneesquebec `registre-des-entreprises` | legal identity + status + constitution |
| 3 | Sanctions administratives pécuniaires (MELCCFP) | donneesquebec `registre-des-sanctions-administratives-pecuniaires` | monetary sanctions registry |
| 4 | Déclarations de culpabilité | donneesquebec (tags=Registre) | convictions registry |
| 5 | Lésions professionnelles CNESST (dataset) | donneesquebec `lesions-professionnelles` | injury claims (risk signal) |
| 6 | Cadastre allégé | ArcGIS `cadastre_bd_allegee` FeatureServer | provincial lot boundaries |
| 7 | Plan de zonage normalisé v1 | donneesquebec `plan-de-zonage` | one standardized zoning schema for all cities |
| 8 | Statistiques Registre foncier (market index) | donneesquebec `statistiques-du-registre-foncier-du-quebec-sur-le-marche-immobilier` | sales by price range + difficulty index |

Out of scope: web-only/PDF sources (AMP sanctions search, OAGQ/CMEQ/CMMTQ
member directories, Québec 511 map, PGA-Eau guides, SADC network) — not
machine-readable, would require scraping, and scraping is what produced
dirty/weak data before.

## The NEQ linking reality (verified)

- `Company` and `MunicipalSupplier` already have `neq` columns (indexed).
- `Permit` has only `applicantName`/`applicantContact` (no NEQ) — applicants are
  private citizens in most cities, so a permit-level NEQ is rarely available.
- `RbqLicense` has `licenseNumber` but no `neq` column — BUT the RBQ license
  number's first 4 digits ARE the NEQ (e.g. RBQ `1234-5678-01` → NEQ starts with
  `1234`). The link is derivable, not missing.
- `TenderAward` already stores `winnerName`; linking to NEQ requires name-match
  against `Registre des entreprises` (fuzzy, with confidence label).

**Conclusion:** NEQ-linking is feasible. The strongest, most honest link is
RBQ-license → NEQ (deterministic from the license number). Name-based links
(award winner → NEQ) are fuzzy and must be labeled with confidence, never
asserted as certain.

## Architecture

Nine units. Each has one responsibility, a typed interface, and is testable in
isolation. No unit reads another's internals. New datasets reuse the existing
`syncDataset` pipeline and registry pattern; they are NOT special-cased.

### Unit 1: Dataset registry entries (the 8 sources)
**What:** add 8 entries to `DATASETS` in `src/lib/datasets/registry.ts`, each
with `id`, `ckanId`/`url`, `format`, `syncEnabled`, `priority`, `city: null`
(provincial). Each maps to a fetcher via the existing `getFetcher(id)` dispatch.
**Interface:** existing `DatasetConfig` shape; no new type.
**Test:** registry exposes all 8 ids; `isDatasetSyncEnabled` returns true for
each; each has a non-empty `ckanId` or `url`.

### Unit 2: Fetchers for the 8 datasets
**What:** `src/lib/datasets/fetchers/` — one fetcher per dataset reusing the
existing CKAN/ArcGIS/CSV helpers (`fetchCkanDatastoreSearch`, `fetchCsv`).
Each returns normalized rows shaped to its target Prisma model.
**Interface:** `(opts) => Promise<NormalizedRow[]>` matching the runner contract.
**Test:** each fetcher parses a fixture row into the documented shape; bad/empty
rows are dropped, never thrown.

### Unit 3: Schema additions (Prisma models + migrations)
**What:** add models for the new data:
- `RenaRecord { id, neq, name, status, offence, startDate, endDate, sourceUrl }`
- `EnterpriseRecord { id, neq, name, legalStatus, constitutionDate, address, sourceUrl }` (Registre)
- `SanctionRecord { id, neq?, name, law, amount, date, sourceUrl }`
- `ConvictionRecord { id, neq?, name, offence, date, sourceUrl }`
- `InjuryClaim { id, employerName, neq?, claimCount, year, sourceUrl }`
- `CadastreLot { id, lotNumber, geom (Json), city, sourceUrl }`
- `ZoningStandard { id, city, zoneCode, allowedUses (Json), sourceUrl }`
- `MarketIndex { id, region, priceRange, salesCount, difficultyIndex, period, sourceUrl }`
- Add `neq String? @unique` to `RbqLicense` (derived from licenseNumber on sync).
**Interface:** Prisma models; one migration.
**Test:** migration applies cleanly on SQLite (dev) and Postgres (prod); round-
trip insert/read works.

### Unit 4: NEQ derivation + resolver
**What:** `src/lib/compliance/neq-resolver.ts`:
- `rbqToNeq(licenseNumber): string | null` — deterministic (first 4 digits of
  the RBQ number = NEQ prefix; documented RBQ numbering convention).
- `findEnterpriseByNeq(neq): Promise<EnterpriseRecord | null>` — Registre lookup.
- `nameToNeq(name): Promise<{ neq, confidence }[]>` — fuzzy name match against
  `EnterpriseRecord`, returns ranked candidates with confidence (never a single
  asserted match).
**Interface:** typed return; confidence labels "high"|"medium"|"low".
**Test:** `rbqToNeq("1234-5678-01")` → `"1234"`; name match returns confidence;
no false-exact assertion.

### Unit 5: Compliance aggregator (the verified dossier)
**What:** `src/lib/compliance/contractor-compliance.ts` — given an NEQ (or an
RBQ license number), assemble a `ContractorCompliance` dossier:
```
type ContractorCompliance = {
  neq: string | null;
  legalName: string | null;
  legalStatus: "active" | "dissolved" | "unknown";
  rbqLicense: { number, subclass, status, expiry } | null;
  renaNonAdmissible: { active: boolean, offence?, startDate?, endDate? } | null;
  sanctions: { count, recent: SanctionRecord[] };
  convictions: { count, recent: ConvictionRecord[] };
  injuryClaims: { totalClaims, recentYear } | null;
  awardsWon: { count, totalValue, recent: TenderAward[] };
  publicBidEligible: boolean;   // false if RENA active
  overallRisk: "low" | "medium" | "high" | "unknown";
}
```
**Interface:** `assembleCompliance(neqOrLicense): Promise<ContractorCompliance>`.
**Depends on:** all new tables + RbqLicense + TenderAward + neq-resolver.
**Test:** a RENA-active NEQ → `publicBidEligible: false`, `overallRisk: high`;
a clean NEQ → `publicBidEligible: true`; missing data → `unknown`, never faked.

### Unit 6: Fit-score compliance gate
**What:** extend `src/lib/opportunities/contractor-fit-profile.ts` — if the
contractor's NEQ is RENA-non-admissible, force `level: "weak"` with a breakdown
entry "non-admissible aux contrats publics" (overrides RBQ/region/budget). This
makes compliance a hard gate, consistent with the RBQ-mismatch gate from last
session.
**Interface:** existing `scoreOpportunityForUser` gains an optional
`compliance: ContractorCompliance | null` input.
**Test:** RENA-active contractor scores weak on a tender regardless of other
matches; clean contractor unaffected.

### Unit 7: Surface compliance in the dossier + feed
**What:** add `compliance?: ContractorCompliance` to `OpportunityDossier` (for
the awarded/winning contractor of a tender, and for any licensee surfaced).
Wire `assembleCompliance` into the feed route for tenders (resolve award winner
NEQ → compliance) and permit contact leads (each licensed contractor → brief
compliance badge: eligible / non-admissible / unknown).
**Interface:** optional field; honest labels in the UI.
**Test:** a tender with an awarded contractor whose NEQ is RENA-active shows
`compliance.publicBidEligible: false`; a clean one shows `true`.

### Unit 8: Zoning standardization + cadastre in parcel verdict
**What:** extend `src/lib/compliance/parcel-verdict.ts` to also consult
`ZoningStandard` (allowed uses for the parcel's zone) and `CadastreLot` (which
lot the point falls in). The verdict gains `zoningUses?: string[]` and
`lotNumber?: string` when available, strengthening "can I build this here."
**Interface:** existing `ParcelVerdict` gains optional fields.
**Test:** a point in a residential-only zone returns `zoningUses: ["résidentiel"]`;
absence of zoning data → `unknown_layer` (unchanged honest fallback).

### Unit 9: Market-heat signal in value estimate
**What:** extend `src/lib/permits/value-estimate.ts` to consume a
`MarketIndex` (sales by price range + difficulty index for the region) and
adjust the value band's confidence: a hot market (high sales, low difficulty)
raises confidence; a cold market lowers it. This makes the derived value
responsive to real market conditions, not static heuristics.
**Interface:** `EstimateOptions` gains optional `marketIndex`.
**Test:** high-activity market → confidence "high" where it was "low"; cold
market → confidence "low".

## Data flow

```
8 new datasets (sync pipeline) ──► 8 new tables + RbqLicense.neq
        │
        ├── neq-resolver ───────────► NEQ (deterministic from RBQ) + fuzzy name
        │
        ├── contractor-compliance ──► ContractorCompliance (RENA + sanctions +
        │                              convictions + injuries + awards + status)
        │
        ├── contractor-fit-profile ─► FitScore (RENA = hard weak gate)
        │
        ├── parcel-verdict ────────► ParcelVerdict (+ zoningUses, lotNumber)
        │
        └── value-estimate ────────► ValueEstimate (market-adjusted confidence)

feed/dossier API ──► public (band + magnet) | auth (full compliance dossier)
```

## Error handling

- Every new fetcher drops bad rows and continues; a full-source failure is
  logged but does not break sync (existing runner behavior).
- NEQ/name fuzzy matches always carry confidence; the UI never asserts a
  certain identity from a fuzzy match.
- Missing compliance data → `unknown`/`null`, never faked ("aucune donnée
  indexée").
- RENA non-admissible is the only hard override (legal gate).

## Testing

Unit tests (vitest) for units 4–9 with documented cases. Fetchers (unit 2)
tested with fixtures derived from real row shapes. Integration in `verify-deploy`
extended to assert a tender's awarded contractor carries a `compliance` block.

## Verification of done (must hold before any "done" claim)

1. `npm run lint && npm run typecheck && npm run test && npm run build` pass.
2. GitHub CI green; Vercel prod deployed; migration applied.
3. The 8 new datasets each have > 0 rows after a sync (verified via
   `/api/sync/status` and direct counts).
4. A live tender dossier whose awarded contractor is RENA-listed shows
   `compliance.publicBidEligible: false` (or, if none is RENA-listed, at least
   shows `compliance.publicBidEligible: true` with the compliance block present).
5. `RbqLicense.neq` is populated (derived) on > 50% of active licenses.
6. `verify:deploy` passes with the new compliance assertion.
7. No new 500s in fresh Vercel logs.

If any fail, the work is **not** declared done.

## Honest limits

- Permit-level NEQ is rarely published (applicants are private) — compliance
  applies to the *contractor/licensee/award-winner* side, not the permit
  applicant. This is stated honestly in the UI.
- Name→NEQ fuzzy matching can produce false positives; results are labeled with
  confidence and never auto-asserted.
- Not every Quebec dataset is machine-readable; web-only sources (AMP search,
  professional-order directories) are excluded to avoid scraping-derived dirt.
