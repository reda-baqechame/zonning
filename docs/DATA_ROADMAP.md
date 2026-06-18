# ZONNING Data Roadmap

Government open-data catalog for Quebec construction intelligence.

## Summary

| Metric | Value |
|--------|-------|
| Total datasets | 33 |
| Coverage cities | 10 |
| Fast-tier SLA | ~15 minutes |
| Daily-tier SLA | ~4 hours |
| Weekly-tier SLA | ~7 days |

## Wave 1 — Verdict depth

- `pum2050-zoning` — PUM 2050 intensification/affectation (Montreal CKAN)
- `contamination-gtc` — Provincial GTC contaminated sites
- `heritage-lpc` — LPC protected sites (polygons → centroids)
- `pum2050-heritage` — PUM 2050 patrimoine layer
- `permit-delays` — Harmonized permit delay stats (MTL)
- `transactions-2025` — Property transactions 2025 (when CKAN live)

## Wave 2 — Geographic expansion

- `projects-sherbrooke` — ArcGIS residential projects
- `zoning-trois-rivieres` — V3R zoning GeoJSON
- `roadworks-saguenay` — Chantiers 511
- `projects-brossard` — Scaffold (allowlisted)
- `permits-levis` — Scaffold (allowlisted)

## Wave 3 — SEAO depth

- Awards sync ingests amendments (`SeaoAmendment`) and completed contracts
- `contracts-boroughs` — Montreal borough contracts (allowlisted if CKAN missing)

## Wave 4 — Intelligence

- `SiteIntelligence` layers: pum2050, gtc, lpc, regionalZoning
- Pipeline Score v2 weights GTC + PUM 2050
- `/api/sync/health` exposes `datasetCount`, `coverageCities`, `freshnessSla`

## Wave 5 — Scale

- Transactional chunk upserts (permits/RBQ)
- `OrgWebhook.filters` JSON for per-org webhook scoping
- `toronto-permits` behind `EXPAND_ONTARIO=true`
- PostGIS geometry columns — `npm run db:postgis` + `src/lib/spatial.ts` (Postgres production)
- iCherche Québec geocoder for PERMIS.AI (`src/lib/geocode.ts`)
- Quality rules cover all 33 active datasets (`src/lib/sync/quality-rules.ts`)

## Bootstrap allowlist

Datasets allowed empty at bootstrap:

- `permits-gatineau`
- `permits-levis`
- `projects-brossard`
- `transactions-2025`
- `contracts-boroughs`
- `toronto-permits`

## Environment overrides

| Variable | Purpose |
|----------|---------|
| `GATINEAU_PERMITS_CKAN_ID` | Gatineau permits when Données Québec publishes |
| `GATINEAU_PERMITS_STATS_URL` | Interim Gatineau CSV |
| `BROSSARD_PROJECTS_URL` | Brossard project CSV |
| `LEVIS_PERMITS_URL` | Lévis permits CSV |
| `EXPAND_ONTARIO` | Set `true` to enable Toronto permit sync |
| `TORONTO_PERMITS_URL` | Toronto CSV when `EXPAND_ONTARIO=true` |

## Production bootstrap

```bash
npm run bootstrap:prod
npm run verify:deploy
```
