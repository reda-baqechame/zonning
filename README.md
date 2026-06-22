# ZONNING

ZONNING is a Quebec construction-data search and coverage application. It indexes
public records where a working adapter exists and shows unavailable or
document-only states where evidence is missing.

## Current truth

- Local development uses SQLite and may contain seeded records. The app labels
  that state visibly; local scores are test output, not live commercial leads.
- Registered sources, sync-enabled configurations, and indexed records are
  separate counts. Use the coverage and sync-health endpoints for current values.
- Permit coverage counts come from records actually present in the database.
- A registered source is not described as indexed unless records are available.
- Email, Stripe, and other external integrations fail explicitly when they are
  not configured. They do not return demo success responses.
- Billing and monetization surfaces remain paused until Stripe and fulfillment
  behavior are configured and verified.

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
| **Search** | Address, municipality, permit, tender, company, RBQ, and source search with evidence limits |
| **Coverage** | Registered-source, indexed-record, and synchronization status |
| **Feed** | Profile-ranked permits and tenders; local seed status is shown explicitly |
| **Dossier** | Address evidence report; returns unavailable when no verified property evidence matches |
| **Companies** | Indexed company, supplier, and RBQ records |
| **Settings** | Trades, regions, RBQ, AMP, notification, and account preferences |

## Data pipeline

Dataset support varies by source. Some registry entries have working ingestion
adapters; others are document-only references. Inspect current runtime truth
instead of relying on this document:

```bash
npm run db:sync
curl http://localhost:3000/api/coverage/public
curl http://localhost:3000/api/sync/health
npm run verify:deploy
```

## Production

See [docs/DEPLOY.md](docs/DEPLOY.md). API: [docs/API.md](docs/API.md). Build log: [docs/BUILD_LOG.md](docs/BUILD_LOG.md).
