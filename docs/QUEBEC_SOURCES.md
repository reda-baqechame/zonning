# Quebec open-data source catalog

Run `npx tsx scripts/discover-quebec-sources.ts` to refresh CKAN probe results into `quebec-sources-discovery.json`.

## Env URL overrides (production)

When Données Québec CKAN is empty or unpublished, set direct CSV/GeoJSON/ArcGIS URLs:

| Variable | Dataset |
|----------|---------|
| `LEVIS_PERMITS_URL` | permits-levis |
| `LONGUEUIL_PERMITS_URL` | permits-longueuil (fallback) |
| `GATINEAU_PERMITS_CKAN_ID` | permits-gatineau CKAN package id |
| `GATINEAU_PERMITS_STATS_URL` | permits-gatineau direct CSV |
| `SHERBROOKE_PERMITS_URL` | permits-sherbrooke |
| `V3R_PERMITS_URL` | permits-trois-rivieres |
| `SAGUENAY_PERMITS_URL` | permits-saguenay |
| `TERREBONNE_PERMITS_URL` | permits-terrebonne |
| `REPENTIGNY_PERMITS_URL` | permits-repentigny |
| `BROSSARD_PERMITS_URL` | permits-brossard |
| `BROSSARD_PROJECTS_URL` | projects-brossard |
| `SJR_PERMITS_URL` | permits-saint-jean-richelieu |
| `DRUMMONDVILLE_PERMITS_URL` | permits-drummondville |
| `SAINT_JEROME_PERMITS_URL` | permits-saint-jerome |
| `GRANBY_PERMITS_URL` | permits-granby |
| `SAINT_HYACINTHE_PERMITS_URL` | permits-saint-hyacinthe |
| `SHERBROOKE_ZONING_URL` | zoning-sherbrooke |
| `QUEBEC_ZONING_URL` | zoning-quebec |
| `LAVAL_ZONING_URL` | zoning-laval |
| `LONGUEUIL_ZONING_URL` | zoning-longueuil |
| `AMP_REGISTRY_URL` | amp-registry |
| `RBQ_INFRACTIONS_URL` | rbq-infractions |
| `MTL_INSPECTIONS_URL` | inspection-violations-mtl |

## Live CKAN (no env required)

- Montréal, Laval, Longueuil, Québec, SEAO, RBQ licences, PUM 2050, GTC, most heritage layers
- Trois-Rivières zoning (GeoJSON)

## Coverage

17 cities in `COVERAGE_CITIES`, 52 active datasets (excluding legacy `zoning` and optional Toronto).
