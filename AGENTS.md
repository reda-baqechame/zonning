<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ZONNING — coding agent guide

Quebec construction intelligence for permits, SEAO, RBQ, zoning, compliance, and scheduled public-data synchronization. Runtime coverage endpoints are the source of truth for indexed records and currently available municipalities.

## Credentials — where agents read secrets

**Never commit or paste secret values into chat, PRs, or tracked files.**

Local files (gitignored, read in this order via `scripts/load-prod-env.ts`):

| File | Purpose |
|------|---------|
| `.env.production.local` | **Primary** — pull from Vercel (`vercel env pull`) |
| `.env.production.secrets` | Manual overrides (CRON_SECRET, etc.) |
| `.env.local` | Dev + Vercel integration vars (Supabase, Upstash/KV) |
| `.env` | Fallback (`DATABASE_URL` for SQLite dev) |

**Refresh production secrets locally:**

```bash
npx vercel env pull .env.production.local --environment=production
```

**Audit what's set (no values printed):**

```bash
npm run agent:env
```

### Vercel (production source of truth)

- **Project:** `zonning` (linked via `.vercel/project.json`)
- **URL:** https://zonning.vercel.app
- **Dashboard:** https://vercel.com → Project → Settings → Environment Variables
- **Integrations already wired:** Supabase (Postgres), Upstash/KV (rate limits)

Vercel marketplace aliases (app resolves these automatically):

| You may see in pulled env | App resolves as |
|---------------------------|-----------------|
| `POSTGRES_PRISMA_URL`, `POSTGRES_URL` | `DATABASE_URL` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis |

### GitHub Actions (cron fallback)

Repository secrets at https://github.com/reda-baqechame/zonning/settings/secrets/actions:

| Secret | Value |
|--------|--------|
| `APP_URL` | `https://zonning.vercel.app` |
| `CRON_SECRET` | Same as Vercel `CRON_SECRET` |

### Demo app login (local seed)

After `npm run db:seed`:

- **Email:** `demo@zonning.ca`
- **Password:** `demo1234`

### Admin access

Users whose email is in `ADMIN_EMAILS` get `/dashboard`, concierge, sync admin.

---

## Full credential inventory

### Required for production

| Variable | Service | Notes |
|----------|---------|-------|
| `DATABASE_URL` / `POSTGRES_PRISMA_URL` | Supabase Postgres | Pooler port 6543 + `?pgbouncer=true` |
| `CRON_SECRET` | App | Protects `/api/cron/*`, `/api/sync/*` — min 32 chars |
| `SESSION_SECRET` | App | Must differ from `CRON_SECRET` |
| `NEXT_PUBLIC_APP_URL` | App | Public https URL (not localhost) |
| `ADMIN_EMAILS` | App | Comma-separated admin emails |
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` | Upstash | Distributed rate limits |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | Upstash | Pair with URL above |
| `SYNC_ENABLED` | App | `true` (default) |

### Strongly recommended

| Variable | Service | Notes |
|----------|---------|-------|
| `RESEND_API_KEY` | Resend | Email alerts + digests |
| `EMAIL_FROM` | Resend | e.g. `ZONNING <onboarding@resend.dev>` |

### Optional (app degrades gracefully)

| Variable | Service | When missing |
|----------|---------|--------------|
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` | Stripe | Billing plans and payment actions stay disabled |
| `TWILIO_*` | Twilio | SMS alerts disabled |
| `OPENAI_API_KEY` | OpenAI | Fallback verdict summaries |
| `SENTRY_DSN` | Sentry | No error monitoring |

### Quebec dataset scaffold URLs

Empty = dataset registered but may have **0 rows** until URL is set. Catalog: **`docs/QUEBEC_SOURCES.md`**. Discovery:

```bash
npm run discover:quebec
```

See `.env.production.example` for the full list (`LEVIS_PERMITS_URL`, `GATINEAU_PERMITS_CKAN_ID`, `AMP_REGISTRY_URL`, etc.).

---

## Architecture map

```
src/app/[locale]/     → UI (fr/en via next-intl)
src/app/api/          → REST + cron
src/lib/datasets/     → source registry + ingestion adapters
src/lib/sync/         → schedulers, RGM polling, health summary
src/lib/quebec-coverage.ts → tracked municipalities and synchronization targets
prisma/schema.prisma  → SQLite dev / Postgres prod
vercel.pro.json       → optional higher-frequency cron configuration
.github/workflows/sync-datasets.yml → GitHub cron fallback
```

## Commands agents use

```bash
npm run agent:env          # credential audit (safe)
npm run dev                # local dev (SQLite from .env)
npm run ci                 # lint + typecheck + test + build
npm run launch-checklist   # prod env green/red
npm run setup:postgres     # db push + PostGIS (needs Postgres URL)
npm run bootstrap:prod     # sync all datasets to prod DB
npm run verify:deploy      # remote health checks (16 checks)
npm run finish-deploy      # postgres + deploy + bootstrap + verify
npm run discover:quebec    # probe CKAN/ArcGIS sources
npm run generate-secrets   # new CRON_SECRET + SESSION_SECRET
```

Load prod env in scripts: `import { loadProdEnv } from "./scripts/load-prod-env"; loadProdEnv();`

## Bootstrap order (first production deploy)

1. `npm run generate-secrets` → paste in Vercel
2. Supabase + Upstash via Vercel integrations (or manual)
3. `vercel link && vercel --prod`
4. `DATABASE_URL=... npm run setup:postgres`
5. `npm run bootstrap:prod` (loads `.env.production.local`)
6. GitHub secrets: `APP_URL`, `CRON_SECRET`
7. `npm run verify:deploy`

Full runbook: **`LAUNCH.md`**. Human setup links: **`SETUP_AUTH_LINKS.md`**.

## Authenticated API patterns

```bash
# Cron / sync (production)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/cron/sync?mode=rgm"

# Public health
curl "$NEXT_PUBLIC_APP_URL/api/health"
curl "$NEXT_PUBLIC_APP_URL/api/coverage/public"
```

## Product gates

| Page | Requirement |
|------|-------------|
| `/feed`, `/settings` | Auth + onboarding |
| `/compliance` | PRO+ |
| `/export` | Essentiel+ |
| `/dashboard` | `ADMIN_EMAILS` |
| `/api/v1/*` | Équipe plan + API key |

## Key pages (public moat)

- `/coverage` — 17-city breakdown, sync health
- `/intelligence` — address explorer
- `/developers` — API docs

## Cursor rules

Project conventions: **`.cursor/rules/zonning.mdc`**

## Do not

- Commit `.env*`, secrets, or real `DATABASE_URL` values
- Print secret values in logs, commits, or PR descriptions
- Edit files under `.cursor/plans/`
- Use `prisma migrate deploy` on Vercel — build uses `db push` via `vercel-build`
