<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ZONNING — agent guide

Quebec construction intelligence platform: permits, SEAO tenders, RBQ fit, compliance vault, 33 public datasets.

## Architecture map

```
src/app/[locale]/     → UI pages (fr/en via next-intl)
src/app/api/          → REST + cron endpoints
src/lib/datasets/     → registry + fetchers
src/lib/sync/         → schedulers, quality, auto-refresh
src/lib/env.ts        → prod validation + integration flags
prisma/schema.prisma  → SQLite (dev) / switch provider for Postgres prod
vercel.json           → 8 Vercel crons
.github/workflows/    → CI + GitHub cron fallback
```

## Bootstrap order (first production deploy)

1. `npm run generate-secrets` → paste `CRON_SECRET`, `SESSION_SECRET` in Vercel
2. Create Supabase project → pooler `DATABASE_URL` in Vercel
3. `vercel link && vercel --prod`
4. `DATABASE_URL=... npm run setup:postgres`
5. `NEXT_PUBLIC_APP_URL=... CRON_SECRET=... npm run bootstrap:prod`
6. GitHub secrets: `APP_URL`, `CRON_SECRET`
7. `npm run verify:deploy`

Full checklist: **`LAUNCH.md`**. Env template: **`.env.production.example`**.

## Pre-deploy validation

```bash
npm run launch-checklist   # local env green/red
npm run ci                 # test + lint + build
```

## Product gates

| Page | Requirement |
|------|-------------|
| `/feed`, `/settings` | Auth + onboarding complete |
| `/compliance` | PRO+ plan |
| `/export` | Essentiel+ plan |
| `/dashboard` | Admin email in `ADMIN_EMAILS` |

Session user includes `onboardingComplete`, `alertSmsEnabled`, `stripeCustomerId` via `getSessionUser()`.

## Integrations

| Service | Env vars | Notes |
|---------|----------|-------|
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Required for email alerts in prod |
| Upstash | `UPSTASH_*` | Distributed rate limits |
| Stripe | `STRIPE_*` | Demo mode OK until keys set |
| Twilio | `TWILIO_*` | SMS (Pro+, user opt-in) |

Health: `GET /api/health` returns `integrations.*` booleans.

## Cursor rules

Project-specific conventions live in **`.cursor/rules/zonning.mdc`**.

## Do not

- Commit secrets or `.env`
- Edit files under `.cursor/plans/`
- Use `prisma migrate deploy` on Vercel Postgres — use `db push` via `vercel-build`
