# ZONNING — Sign in here, then say "done with step X"

I opened these in your browser. Complete **in order** — each step takes ~2 min.

---

## STEP 1 — Supabase (database) ← DO THIS FIRST

**Accept Vercel terms + install (easiest — auto-adds DATABASE_URL):**

1. **[Accept Supabase terms on Vercel](https://vercel.com/redabaquechame58-2565s-projects/~/integrations/accept-terms/supabase?source=cli)** ← sign in if asked
2. Then run in terminal (or tell Cursor to run): `npx vercel integration add supabase`
3. Follow prompts → create/link Supabase project → **connect to project `zonning`**
4. Confirm `DATABASE_URL` appeared in [Vercel env vars](https://vercel.com/redabaquechame58-2565s-projects/zonning/settings/environment-variables)

**Alternative (manual):** [supabase.com/dashboard](https://supabase.com/dashboard/sign-in) → new project → copy pooler URI → paste as `DATABASE_URL`

Say: **"done with step 1"**

---

## STEP 2 — Upstash (rate limits)

1. **[Accept Upstash terms on Vercel](https://vercel.com/redabaquechame58-2565s-projects/~/integrations/accept-terms/upstash?source=cli)**
2. Then: `npx vercel integration add upstash/upstash-kv`
3. Create Redis database → connect to **`zonning`**
4. Confirm `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env

**Alternative:** [console.upstash.com](https://console.upstash.com/auth/sign-in) → Create Redis → REST API tab → paste manually

Say: **"done with step 2"**

---

## STEP 3 — Resend (email)

1. **[Sign up / login Resend](https://resend.com/signup)**
2. **[Create API key](https://resend.com/api-keys)**
3. Add to [Vercel env](https://vercel.com/redabaquechame58-2565s-projects/zonning/settings/environment-variables):
   - `RESEND_API_KEY` = `re_...`
   - `EMAIL_FROM` = `ZONNING <onboarding@resend.dev>` (works without domain verification)

Say: **"done with step 3"**

---

## STEP 4 — GitHub Actions (cron backup)

1. **[GitHub login](https://github.com/login)** if needed
2. **[Add repo secrets](https://github.com/reda-baqechame/zonning/settings/secrets/actions)**:
   - `APP_URL` = `https://zonning.vercel.app`
   - `CRON_SECRET` = copy from Vercel env dashboard (same value already set)

Or terminal: `gh auth login` → then tell Cursor to set secrets

Say: **"done with step 4"**

---

## STEP 5 — Cursor finishes automatically

After steps 1–3 (minimum), say:

> **"All done, run finish-deploy"**

Cursor runs: Postgres schema → redeploy → bootstrap 33 datasets → verify 12/12

---

## Already configured ✓

| Item | Status |
|------|--------|
| App live | https://zonning.vercel.app |
| Vercel project | linked + GitHub connected |
| CRON_SECRET, SESSION_SECRET | set |
| NEXT_PUBLIC_APP_URL | set |
| Code + CI | 32 tests pass |

## Check progress anytime

https://zonning.vercel.app/api/health

When `ready: true` → you're live.

---

## Open all links at once (Windows)

```
npm run setup:links
```
