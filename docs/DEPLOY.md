# ZONNING Production Deployment

## Prerequisites

- [Vercel](https://vercel.com) account (Pro recommended for 5-minute crons)
- [Supabase](https://supabase.com) project (Postgres) for production
- [Resend](https://resend.com) API key (email alerts)

## 1. Supabase Postgres

1. Create a Supabase project → Settings → Database → Connection string (URI, pooler mode for serverless).
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. Set `DATABASE_URL` to your Supabase connection string.

```bash
npx prisma migrate deploy
npx tsx prisma/seed.ts   # optional demo data
```

For local dev with SQLite, keep `provider = "sqlite"` on a dev branch.

**Dual-database workflow:** `src/lib/prisma.ts` auto-selects SQLite vs Postgres from `DATABASE_URL`. Use SQLite locally; Postgres on Vercel. Run `prisma migrate deploy` on production only.

## 2. Vercel environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Supabase Postgres URI |
| `CRON_SECRET` | Yes | Random string; Vercel Cron sends as Bearer token |
| `SYNC_ENABLED` | Yes | `true` — enables automatic background sync |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-app.vercel.app` |
| `LIVE_SYNC_INTERVAL_MINUTES` | No | Default `5` — fast-tier on-demand refresh |
| `SYNC_BATCH_SIZE` | No | Default `8` — datasets per scheduler cron |
| `RESEND_API_KEY` | Yes | Resend API key |
| `EMAIL_FROM` | No | Default: `ZONNING <alerts@zonning.ca>` |
| `STRIPE_*` | No | Billing actions remain disabled until the complete Stripe configuration is present |
| `STRIPE_WEBHOOK_SECRET` | Yes (if Stripe) | Webhook at `/api/stripe/webhook` |
| `ADMIN_EMAILS` | **Yes (prod)** | Comma-separated; no default in production |
| `TWILIO_*` | No | SMS alerts for Pro+ |
| `OPENAI_API_KEY` | No | AI tender/permit summaries |
| `UPSTASH_REDIS_REST_URL` | Prod recommended | Distributed rate limits (login, API v1) |
| `UPSTASH_REDIS_REST_TOKEN` | Prod recommended | Upstash REST token |
| `SENTRY_DSN` | No | Server error tracking (`@sentry/nextjs`) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Client Sentry DSN (optional) |
| `GATINEAU_PERMITS_CKAN_ID` | No | Override when Gatineau CKAN goes live on Données Québec (no dataset yet) |
| `GATINEAU_PERMITS_STATS_URL` | No | Optional direct CSV URL from ville.gatineau.qc.ca until CKAN is published |
| `SESSION_SECRET` | **Yes (prod)** | HMAC signing key for session cookies (must differ from `CRON_SECRET`) |
| `CASL_LEGAL_REVIEWED` | No | Set `true` after lawyer review of CASL PDF template |
| `SENTRY_ORG` / `SENTRY_PROJECT` | If Sentry | For source map upload in CI (optional) |

### Postgres cutover checklist

1. Create Supabase project; copy **pooler** connection string (`?pgbouncer=true`).
2. Set `DATABASE_URL` on Vercel (production).
3. On prod branch: set `provider = "postgresql"` in `prisma/schema.prisma` OR maintain a prod branch with Postgres provider.
4. `npm run setup:postgres` against Supabase (schema + PostGIS).
5. `npm run bootstrap:prod` — chunked bootstrap + `verify:deploy` (33 datasets).
6. `npm run verify:deploy` — expect healthy sync for all active datasets (allowlisted gaps documented below).

### One-command bootstrap (after deploy)

```bash
# Set NEXT_PUBLIC_APP_URL + CRON_SECRET, then:
npm run bootstrap:prod
```

This runs `GET /api/health`, `POST /api/cron/sync?mode=bootstrap&rounds=6`, chunked `tier=all`, then `verify:deploy`.

### Postgres note (SQLite migrations → Supabase)

Existing migrations were generated for SQLite. On a **fresh** Supabase database, use:

```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

For ongoing prod schema changes, maintain `provider = "postgresql"` on the production branch and prefer `db push` or add Postgres-native migrations as the project matures.

## 3. Deploy

```bash
vercel link
vercel env pull
vercel --prod
```

Build runs `npx tsx scripts/vercel-build.ts` via `vercel-build` script (Postgres: `db push`; SQLite: `migrate deploy`).

## 4. One-time initial sync

After first deploy, populate all **33** government datasets:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/sync?mode=bootstrap&rounds=6"
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/sync?tier=all"
```

Or: `npm run bootstrap:prod`

RBQ (~25k licenses) resumes across multiple cron ticks automatically.

## 5. Automatic sync (zero manual work)

| Trigger | Schedule | What it does |
|---------|----------|--------------|
| Vercel cron | Every **6 h** | `?mode=bootstrap&rounds=4` — never-synced datasets on cold deploys |
| Vercel cron | Every **5 min** | `?mode=live` — CKAN change detection on permits + SEAO + roadworks |
| Vercel cron | Every **15 min** | `?mode=scheduler` — 8 most-stale/changed datasets |
| Vercel cron | Every **4 h** | `?tier=daily` — RBQ, Registre, heritage, contracts, etc. |
| Vercel cron | Weekly (Sun 8:00 UTC) | `?tier=weekly` — property/tax/zoning CSVs |
| GitHub Actions | Every **15 min** | live + scheduler safety net |
| GitHub Actions | Every **4 h** | daily tier |
| GitHub Actions | Nightly 3:00 UTC | `?tier=all` — full reconciliation |
| API requests | On demand | Routes trigger background refresh if stale (5 min fast tier) |
| Cold start | Once | `instrumentation.ts` bootstraps never-synced datasets |

**Expected freshness:**

- Permits (4 cities) + SEAO tenders + roadworks: **~5–15 minutes**
- RBQ, suppliers, heritage, contracts: **~4 hours**
- Property assessments, taxes, transactions: **weekly** (skipped if CKAN file unchanged)

## 6. Verify cron jobs

After deploy, check Vercel → Project → Cron Jobs:

- `*/5 * * * *` → `/api/cron/sync?mode=live`
- `*/15 * * * *` → `/api/cron/sync?mode=scheduler`
- `0 */4 * * *` → `/api/cron/sync?tier=daily`
- `0 8 * * 0` → `/api/cron/sync?tier=weekly`
- `0 */6 * * *` → `/api/cron/sync?mode=bootstrap&rounds=4`
- `0 12 * * *` → `/api/cron/alerts`
- `0 6 * * *` → `/api/cron/stats` (GTM metrics)
- `0 13 * * 4` → `/api/cron/thursday`

```bash
npm run verify:deploy
# or manually:
curl -H "Authorization: Bearer $CRON_SECRET" -X POST \
  "https://your-app.vercel.app/api/cron/sync?mode=live"
curl https://your-app.vercel.app/api/health
curl https://your-app.vercel.app/api/sync/health
```

## 7. Enterprise hardening checklist

| Control | Implementation |
|---------|----------------|
| Env validation | `src/lib/env.ts` — fails fast at startup in production |
| Cron auth | `Authorization: Bearer $CRON_SECRET` required in production (`src/lib/sync/auth.ts`). Vercel Cron injects this header when `CRON_SECRET` is set in project env. |
| Audit log | `AuditLog` model — admin sync, org API keys/webhooks, Stripe webhooks (`src/lib/audit.ts`) |
| Stripe idempotency | `ProcessedStripeEvent` deduplicates webhook retries |
| Request IDs | `X-Request-Id` on all routes via middleware |
| Rate limits | Upstash **required** in prod; all public + auth APIs limited |
| HTTP resilience | Retries + backoff on CKAN/ArcGIS (`src/lib/http/resilience.ts`) |
| Circuit breaker | Skips datasets with 3+ errors in 15 min (`src/lib/sync/circuit-breaker.ts`) |
| Distributed lock | Prevents overlapping full syncs (`src/lib/sync/runner.ts`) |
| Session security | `SESSION_SECRET` required in prod; legacy cookies rejected |
| Health probes | `GET /api/health` (liveness), `GET /api/sync/health` (dataset freshness) |
| Admin access | `ADMIN_EMAILS` required in prod — no `demo@zonning.ca` fallback |
| GitHub fallback | `.github/workflows/sync-datasets.yml` if Vercel cron misses |

Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` before going live.

### PostGIS (Supabase production)

After Postgres cutover:

```bash
DATABASE_URL="postgresql://..." npm run db:postgis
```

Enables `ST_DWithin` spatial queries in `src/lib/spatial.ts` for GTC, heritage, and zoning lookups. SQLite dev falls back to haversine automatically.

### Geocoding (PERMIS.AI)

Verdict uses permit registry → **iCherche Québec** (Adresses Québec) → OSM fallback. Override with `ICHERCHE_GEOCODE_URL` if needed.

## 8. CI / build hardening

GitHub Actions `.github/workflows/ci.yml` runs on every PR:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Postgres job: `prisma db push` validates schema against PostgreSQL 16 (migrations are SQLite-flavored).

Locally: `npm run ci`

Security headers are set in `next.config.ts`. Legal pages: `/terms`, `/privacy`.

## 9. GitHub Actions sync secrets

Set repository secrets: `APP_URL`, `CRON_SECRET`.

Workflow `.github/workflows/sync-datasets.yml` runs live/scheduler every 15 min plus nightly full sync.

## 10. Gatineau permits

Gatineau is wired in the registry but **Données Québec has no CKAN package yet**. Until publication:

1. Sync returns `empty` without failing (`permits-gatineau` is allowlisted in `verify:deploy`).
2. Set `GATINEAU_PERMITS_CKAN_ID` when the city publishes on donneesquebec.ca.
3. Optionally set `GATINEAU_PERMITS_STATS_URL` to a direct CSV export from ville.gatineau.qc.ca for interim coverage.

ChantierRadar includes a **Gatineau** city filter; data appears once CKAN or the stats URL is configured.

## 11. Local dev auto-sync

```bash
npm run db:sync:watch   # sync all datasets every 30 minutes
```

Set `SYNC_ENABLED=true` in `.env` so API routes trigger background refresh.
