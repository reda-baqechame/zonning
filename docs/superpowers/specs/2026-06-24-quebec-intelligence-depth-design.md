# Quebec Intelligence — Depth Over Breadth (Design)

Date: 2026-06-24
Status: Spec (pending user review)
Owner: contractor intelligence

## Why this exists

Two prior turns shipped "everything is working" claims that were false. Live
production verification on 2026-06-24 shows:

- `searchableMunicipalities: 3` despite "17 cities covered" marketing.
- 11 of 17 permit cities have **0 rows** and are registered against *search-page
  placeholders* (`?q=terrebonne+permis`), not data feeds.
- `syncHealth: degraded`; `permitsToday: 0` everywhere.
- Real permit rows are missing the fields contractors want: `estimatedCost: null`,
  `applicantName: null` on essentially all real Montréal/Québec permits.
- Live feed item lists 7 self-admitted limitations and a `verify_first` triage —
  nothing is actionable.
- **Bug**: Ville de Québec permit coordinates are stored as huge integers
  (`4675216566177939`) instead of decimals (`46.75`), degrading the map and
  "near me" filtering even where real data exists.

Local dev DB is additionally polluted with fake seed rows (`Entreprise Ville 1`,
`100 rue Saint-Ville`, `PM-2026-1000`) which made local QA misleading.

This spec stops that pattern. Direction confirmed with the operator:

- **Depth over breadth** for cities (do not chase fake coverage).
- Make four signals **actually valuable**: money/size, who-to-contact,
  opportunity fit-score, compliance/zoning truth.
- Be **real with users**: derived fields are labeled honestly, never faked.
- Make the app a **lead magnet for contractors**: strongest real opportunities
  visible publicly to convert; full intelligence behind auth.

## Hard constraints (verified from live data)

These shape every decision. They are facts, not preferences.

1. **Montréal & Québec permits never publish cost.** `estimatedCost` is null on
   all real rows. Value must be **derived**, never asserted as a source value.
2. **Applicant/owner is never published** (privacy). "Who to contact" cannot be
   a permit field. It can only come from: SEAO tender `organization`,
   `TenderAward` winning contractor, and RBQ licensee **class** matching
   (licensees licensed to do this work in this region) — never a personal phone
   number scraped from a permit.
3. **`requiredRbqClasses` IS published** on real Québec permits
   (e.g. `["1.1.1"]`) and SEAO tenders carry `organization`,
   `estimatedValue`, `unspsc`, `category`. This is the real eligibility backbone
   that today is being approximated by weak keyword scoring.
4. **Most non-RGM Quebec cities publish no open permit feed.** Longueuil,
   Gatineau, Lévis, Sherbrooke, Saguenay, etc. have no machine-readable permit
   data on Données Québec. The only honest options are: discovery to find any
   feed that *does* exist and was mis-wired, or honest "no open feed" status.
   **Scraping is out of scope** (operator chose depth over breadth, and scraping
   is what produced dirty/weak data before).

## Non-goals (explicitly excluded to prevent the old trap)

- Do NOT wire all 67 registered datasets. That created fake coverage.
- Do NOT add new cities by scraping. No breadth-via-scraping.
- Do NOT publish a derived cost as an exact source number.
- Do NOT fabricate a contact name/phone from a permit.
- Do NOT claim "everything is working" without live API proof showing the new
  derived fields actually present in a real feed item.

## Architecture

Seven focused units. Each has one job, a clear interface, and is testable in
isolation. No unit reads another unit's internals.

### 1. Honest coverage layer
**What:** `lib/datasets/registry.ts` + coverage API + `runtime-summary` report
only real, indexed rows. A city with 0 permits and `document_only`/`unavailable`
status is shown as "Aucune donnée ouverte — vérifier le portail" and is **not**
counted in `searchableMunicipalities` or `coverageCities`-as-covered.
**Interface:** existing `getRegisteredDatasetIds()` / `isDatasetSyncEnabled()`
are already correct; the fix is in the *aggregators* that currently count a
registered city as "covered."
**Depends on:** registry config (no change), `Permit`/`Tender` row counts.
**Test:** a city with `coverageStatus: document_only` and 0 permits must not
appear in the "covered" count, and must appear in a separate "no open feed"
list with the official portal link.

### 2. Value estimation engine
**What:** `lib/permits/value-estimate.ts` — derive a project-value **band** for
a permit when `estimatedCost` is null, from `permitType` + `workType` +
borough/city median `PropertyTransaction` values + an RBQ-class complexity
multiplier.

**Multiplier source:** the complexity multipliers live in a single documented
constant table in this file (`RBQ_COMPLEXITY_MULTIPLIER`), keyed by RBQ class
(e.g. `1.1.1` new residential → higher multiplier; `E` electrical → mid;
renovation → lower). They are industry-norm heuristics, explicitly labeled as
estimates in `basis`. They are not data fetched from a source.

**Comparable fallback:** when fewer than **N=10** `PropertyTransaction` rows
exist for a borough, the engine widens to the city median, then to a
province-wide default band for that permitType, and the `confidence` drops
accordingly (`high`→`medium`→`low`). If no permitType is recognized at all,
return `kind:"unknown"` — never a fabricated number.

Output type:
```
type ValueEstimate =
 | { kind: "published"; value: number; currency: "CAD" }
 | { kind: "estimated"; low: number; high: number; currency: "CAD";
     confidence: "low"|"medium"|"high"; basis: string[] }
 | { kind: "unknown"; reason: string }
```
Always labeled "estimé" in the UI; basis strings explain the derivation
(e.g. "médiane transactions arrondissement × complexité RBQ 1.1.1").
**Interface:** `estimatePermitValue(permit): ValueEstimate`.
**Depends on:** permit fields, `PropertyTransaction` medians, RBQ class map.
**Test:** known permitType+workType combos return documented bands; a permit
with a published cost returns `kind:"published"` unchanged; an unrecognized
type returns `kind:"unknown"` with a reason (never a fake number).

### 3. Contact / who-to-contact resolver
**What:** `lib/opportunities/contact-resolver.ts` — for a permit, return active
RBQ licensees whose subclass intersects `requiredRbqClasses`. Note: the
`RbqLicense` table has **no region column** (verified), so filtering is by
subclass match only, capped and sorted by holder name. For a tender, surface the
`organization` and the `TenderAward` winner when present.
**Interface:**
```
type ContactLeads = {
 permit?: { licensedContractors: { holderName; licenseNumber; subclass; sourceUrl }[];
            note: string }   // note always states these are LICENSED FOR THIS WORK, not the applicant
 tender?: { buyer: string; awardedContractor?: { name; date; value }; sourceUrl: string }
}
resolveContactLeads(kind, itemId): Promise<ContactLeads>
```
**Honesty rule:** permit contacts are labeled "entreprises titulaires d'une
licence RBQ pour ce type de travaux dans la région" — never "le demandeur."
**Depends on:** `RbqLicense`, `Tender`, `TenderAward`.
**Test:** a permit with `requiredRbqClasses:["1.1.1"]` returns only licensees
whose subclass is 1.1.x or a documented equivalent; licensees of unrelated
classes are excluded; a tender with an award returns the winner; the note string
contains the honesty disclaimer. Region is not asserted (no region column).

### 4. Opportunity fit-score (replaces keyword scoring)
**What:** rewrite `lib/contractor-fit.ts` to score a permit/tender against the
**signed-in user's** `rbqLicenseClass`, `trades`, `regions`,
`minProjectCost`/`maxProjectCost`. Real eligibility: class intersection, region
match, value band overlap, trade keyword intersection. Output 0–100 + a
breakdown of *why* (so the UI can show "vous correspondez: RBQ 1.1.1, région
Montréal, budget 50k–150k").
**Interface:** `scoreOpportunityForUser(item, userProfile): FitScore`.
**Depends on:** value estimate (#2), user profile, registry class map.
**Test:** a contractor with RBQ 1.1.1 + Montréal + budget 50k–150k scores high
on a matching Montréal permit and low on a non-matching class; an unauthenticated
profile returns a public, anonymized score (lead-magnet surface).

### 5. Coordinate parse fix (Ville de Québec)
**What:** root-cause why Québec permit rows store `latitude: 4675216566177939`
(integer-collapsed decimal). Fix the parser in the Québec permit ingestion path
(`fetchers/permits.ts` Québec branch + adapter) to divide/parse into
`46.75216...`. Add a backfill migration to normalize existing rows. Guard with a
range check (`-90..90`, `-180..180`) that rejects/repairs implausible values.
**Interface:** no new API; fixes `Permit.latitude/longitude` for Québec.
**Depends on:** Québec CKAN field mapping.
**Test:** parse a representative Québec CSV row → decimals in valid range; an
integer-collapsed value is repaired; an out-of-range value is nulled (not
stored as garbage).

### 6. Parcel compliance verdict
**What:** `lib/compliance/parcel-verdict.ts` — given an address/coordinates,
return a "can I build this here" verdict assembled from **real indexed layers**:
`ContaminatedSite` (5,501 rows), `HeritageSite` (2,243), zoning polygons where
synced. Replaces the generic "verify zoning" limitation with an actual
tri-state: `clear` / `constraint_present` / `unknown_layer`.
**Interface:**
```
type ParcelVerdict = {
 status: "clear" | "constraint_present" | "unknown_layer";
 constraints: { kind: "contamination"|"heritage"|"zoning"; label: string; sourceUrl: string }[];
 note: string
}
assessParcel(lat, lon, opts?): Promise<ParcelVerdict>
```
**Depends on:** `ContaminatedSite`, `HeritageSite`, zoning polygon tables.
**Test:** a point inside a known contaminated site returns
`constraint_present` with the contamination label; a point far from any layer
returns `clear` only when layers were actually checked (else `unknown_layer`).

### 7. Honest deploy + verification
**What:** after build/typecheck/test/lint/copy-audit pass, push to GitHub, deploy
to Vercel prod, then verify with **real** API calls — and the verification
**must** show the new derived fields in a live feed item (a `value` block that
is `estimated` with a basis, a contact leads block with licensed contractors,
a fit score breakdown). The deploy is only "done" when that evidence exists.
**Interface:** extend `scripts/verify-deploy.ts` with assertions for the new
fields; no new infrastructure.
**Depends on:** all of #1–#6 merged.

## Lead-magnet surface (public → auth gate)

Public surfaces (landing hero, coverage, feed preview) show the strongest
**real** opportunities with the derived band + a one-line "why this fits
contractors" — enough to convert. The full dossier (exact fit breakdown,
licensed-contractor list, parcel verdict, export) sits behind auth. This is
honest (nothing faked to bait) and converts (the value is visible).

## Data flow

```
Permit/Tender/RbqLicense/TenderAward/ContaminatedSite/HeritageSite (real rows)
        │
        ├── value-estimate.ts ───────────► ValueEstimate
        ├── contact-resolver.ts ─────────► ContactLeads (licensed contractors / award)
        ├── parcel-verdict.ts ───────────► ParcelVerdict (contamination/heritage/zoning)
        │
        └──► contractor-fit.ts (uses value + class + region + budget)
                       │
                       ▼
                 FitScore { score, breakdown[] }
                       │
        feed/dossier API ──► public surface (band + magnet line) | auth surface (full)
```

## Error handling

- Every derivation returns a typed result, never throws on missing data:
  `unknown` with a `reason` is the honest fallback.
- All external/derived values carry a `sourceUrl` and a human `basis`/`note`.
- A failed layer (e.g. RBQ query times out) degrades to `unknown_layer`/
  `kind:"unknown"`, not a fake value.
- The verify step fails loudly if a derived field is absent in the live feed.

## Testing

Unit tests (vitest) for #2–#6 with documented cases. Integration in
`verify-deploy.ts` for #7. No network in unit tests; fixtures derived from real
row shapes observed in the dev DB.

## Verification of done (must hold before any "done" claim)

1. `npm run lint && npm run typecheck && npm run test && npm run build` all pass.
2. GitHub CI green on the deploy commit.
3. Live `GET /api/feed?limit=1` returns at least one item whose dossier contains
   a real `ValueEstimate` (estimated band with basis) and a `ContactLeads` block
   (licensed contractors, honesty note) — not `kind:"unknown"` on a permit that
   should be derivable.
4. Live coverage API no longer counts `document_only`/0-row cities as covered.
5. Québec permit coordinates in the live feed are valid decimal degrees.
6. No new 500s in fresh Vercel logs after the deploy.

If any of these fail, the deploy is **not** declared working.
