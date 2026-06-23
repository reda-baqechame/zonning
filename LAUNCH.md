# ZONNING Launch — 5 steps, no code

Finish wiring is done in the repo. You only paste secrets and approve one CLI login.

## Step 1 — Generate secrets (local)

```bash
npm run generate-secrets
```

Copy `CRON_SECRET` and `SESSION_SECRET` (they must differ).

## Step 2 — Create services

| Service | Action |
|---------|--------|
| [Supabase](https://supabase.com) | New project → Database → **Connection string (Pooler)** with `?pgbouncer=true` |
| [Vercel](https://vercel.com) | New project (Pro recommended for 5-min crons) |
| [Resend](https://resend.com) | API key |
| [Upstash](https://upstash.com) | Redis REST URL + token |

## Step 3 — Vercel environment variables

Paste in Vercel → Project → Settings → Environment Variables (Production):

```
DATABASE_URL=postgresql://...pooler...?pgbouncer=true
CRON_SECRET=<from step 1>
SESSION_SECRET=<from step 1>
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
ADMIN_EMAILS=you@company.com
SYNC_ENABLED=true
RESEND_API_KEY=re_...
EMAIL_FROM=ZONNING <alerts@yourdomain.com>
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional later: `STRIPE_*`, `TWILIO_*`, `OPENAI_API_KEY`, `SENTRY_DSN`, city CSV URLs (see `.env.production.example`).

Validate locally before deploy:

```bash
npm run prepare-deploy   # CI + env template + generated secrets
npm run launch-checklist # after pasting env into .env.local
```

## Step 4 — Deploy

```bash
vercel login
vercel link
vercel --prod
```

Update `NEXT_PUBLIC_APP_URL` in Vercel to match the deployed `*.vercel.app` URL, then redeploy once if needed.

Postgres + PostGIS (if not applied by Vercel build):

```bash
DATABASE_URL=postgresql://... npm run setup:postgres
```

Bootstrap datasets:

```bash
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app CRON_SECRET=... npm run bootstrap:prod
```

## Step 5 — GitHub cron fallback

Repository → Settings → Secrets → Actions:

- `APP_URL` = `https://YOUR-PROJECT.vercel.app`
- `CRON_SECRET` = same as Vercel

Verify:

```bash
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app CRON_SECRET=... npm run verify:deploy
```

Expect **18/18 checks pass**.

## Success

- Login → onboarding → `/feed`
- `/api/health` → `ok: true`
- `/api/stats/public` → all sync-enabled datasets, 10 cities
- Vercel dashboard shows 8 cron jobs
- Demo billing works until Stripe keys are added

See [docs/DEPLOY.md](docs/DEPLOY.md) for full reference.

## Deploy session (Cursor + you)

When code wiring is complete, run this sequence once:

| Step | Who | Command / action |
|------|-----|------------------|
| 1 | You | `vercel login` (one-time browser approve) |
| 2 | Cursor | `vercel link` → select/create project |
| 3 | You | Paste all env vars from Step 3 above in Vercel dashboard |
| 4 | Cursor | `vercel --prod` |
| 5 | You | Set `NEXT_PUBLIC_APP_URL` to deployed `*.vercel.app` URL; redeploy if URL changed |
| 6 | Cursor | `DATABASE_URL=... npm run setup:postgres` |
| 7 | Cursor | `NEXT_PUBLIC_APP_URL=... CRON_SECRET=... npm run bootstrap:prod` |
| 8 | You | GitHub → Settings → Secrets → `APP_URL` + `CRON_SECRET` |
| 9 | Cursor | `npm run verify:deploy` → 18/18 |

If `vercel login` is not done, Cursor cannot link or deploy — complete Step 1 first.
