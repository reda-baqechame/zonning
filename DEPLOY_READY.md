# ZONNING — Final deploy steps

**Live:** https://zonning.vercel.app  
**CI:** 32 tests passing  
**Vercel project:** [zonning](https://vercel.com/redabaquechame58-2565s-projects/zonning)

---

## What's already on Vercel

| Variable | Status |
|----------|--------|
| `CRON_SECRET` | ✓ |
| `SESSION_SECRET` | ✓ |
| `SYNC_ENABLED` | ✓ |
| `ADMIN_EMAILS` | ✓ (verify in dashboard) |
| `NEXT_PUBLIC_APP_URL` | ✓ `https://zonning.vercel.app` |

## What YOU must add (3 services, ~10 min)

### 1. Supabase (database)

1. [supabase.com](https://supabase.com) → New project
2. Settings → Database → **Connection string** → **URI** → **Pooler** (port **6543**)
3. Append `?pgbouncer=true` if missing
4. Vercel → Settings → Environment Variables → `DATABASE_URL`

### 2. Upstash (rate limits — required)

1. [upstash.com](https://upstash.com) → Create Redis database
2. Copy **REST URL** + **REST TOKEN**
3. Vercel env: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### 3. Resend (email alerts)

1. [resend.com](https://resend.com) → API Keys
2. Vercel env: `RESEND_API_KEY`, `EMAIL_FROM=ZONNING <alerts@yourdomain.com>`

---

## One-command finish (after env vars are set)

```powershell
# Copy template and fill in values
copy .env.production.local.example .env.production.local
# Edit .env.production.local with your Supabase / Upstash / Resend keys

npm run finish-deploy
```

This runs: `launch-checklist` → `setup:postgres` → `vercel --prod` → `bootstrap:prod` → `verify:deploy`

---

## Manual steps (alternative)

```powershell
# 1. Redeploy after adding Vercel env vars
npx vercel --prod

# 2. Push schema to Supabase
$env:DATABASE_URL="postgresql://..."
npm run setup:postgres

# 3. Bootstrap datasets + verify
$env:NEXT_PUBLIC_APP_URL="https://zonning.vercel.app"
$env:CRON_SECRET="<from Vercel dashboard>"
npm run bootstrap:prod
```

---

## GitHub Actions (cron fallback)

Repo → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `APP_URL` | `https://zonning.vercel.app` |
| `CRON_SECRET` | same as Vercel |

Then run: `gh auth login` locally if you want CLI setup.

---

## Vercel plan: Hobby vs Pro

| Plan | Vercel crons | Recommendation |
|------|--------------|----------------|
| **Hobby** (current) | Daily only or none | Use **GitHub Actions** (already configured) |
| **Pro** | 5-min crons | Run `npm run vercel:plan pro` then redeploy |

Current config: **no Vercel crons** (GitHub handles sync every 15 min).

---

## Verify success

```powershell
curl.exe -s https://zonning.vercel.app/api/health
# Expect: "ready": true, "db": true, no "missing" array

npm run verify:deploy
# Expect: 12/12 checks pass
```

---

## Check health now (before DB is set)

```powershell
curl.exe -s https://zonning.vercel.app/api/health
```

Shows `"missing": ["DATABASE_URL", "UPSTASH_REDIS_REST_URL", ...]` until you add env vars.
