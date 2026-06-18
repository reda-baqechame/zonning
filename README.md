# ZONNING

**Quebec's Revenue & Compliance OS for Builders** — Built with Cursor.

Dual brand: **ZONNING Pro** (feed, billing, modules) + **PERMIS.AI** (public Verdict Stamp).

## Quick start

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000/fr](http://localhost:3000/fr)

**Demo account:** `demo@zonning.ca` / `demo1234`

## Surfaces

| Surface | Description |
|---------|-------------|
| **Feed** | Unified Command Center — permits + SEAO + PERMIS.AI tab |
| **PERMIS.AI** | Free public `/verdict` — shareable development potential stamp |
| **Settings** | RBQ, trades, regions, AMP, SMS alerts |
| **ChantierRadar** | Permits map (Montréal, Laval, Longueuil, Québec, Gatineau), Pipeline Score |
| **MarchésQC** | SEAO matching, countdown, similar awards, AMP badges |
| **PartenairesCA** | Registre + COR/ISO filters + SEAO award cross-links |
| **Compliance Vault** | One-click CASL PDF |
| **Équipe** | Invites, API keys (5 seats) |
| **Concierge** | Admin-delivered opportunity lists |

## Data sync (live)

**22 government datasets** — all wired to CKAN with auto-ingest:

| Layer | What runs | Interval |
|-------|-----------|----------|
| **Live watch** | Permits (5 cities), SEAO, roadworks — CKAN `last_modified` detection | Every **5 min** |
| **Scheduler** | All stale/changed/never-synced datasets | Every **15 min** (8 per batch) |
| **Daily tier** | RBQ, Registre, heritage, contracts, contamination… | Every **4 h** |
| **Weekly tier** | Assessment, taxes, transactions, zoning | Sunday + skip if unchanged |
| **On-demand** | Any API hit (`/feed`, `/permits`, `/verdict`, etc.) triggers background refresh | **5 min** max age (fast tier) |

Crons: `vercel.json` + GitHub Actions fallback. Health: `GET /api/sync/health`.

```bash
npm run db:sync          # manual full sync
curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron/sync?mode=live"
npm run verify:deploy
```

## Production

See [docs/DEPLOY.md](docs/DEPLOY.md). API: [docs/API.md](docs/API.md). Build log: [docs/BUILD_LOG.md](docs/BUILD_LOG.md).

## Pricing

Essentiel $199 · Pro $349 · Équipe $699 · Concierge $2,500
