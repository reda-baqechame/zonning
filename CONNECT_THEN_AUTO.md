# Connect accounts → Cursor does everything else

## YES — once you connect, I run it all automatically.

You only need **one Vercel page** (integrations auto-fill env vars):

### 👉 [Connect Supabase + Upstash to project `zonning`](https://vercel.com/redabaquechame58-2565s-projects/zonning/stores)

On that page:
1. **Supabase** → Add / Connect → create or link project → must attach to **zonning**
2. **Upstash** → Add / Connect → create Redis → must attach to **zonning**

### Resend (2 min, manual — no Vercel integration)

1. [resend.com/api-keys](https://resend.com/api-keys) → Create API Key
2. [Vercel env vars](https://vercel.com/redabaquechame58-2565s-projects/zonning/settings/environment-variables) → add:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` = `ZONNING <onboarding@resend.dev>`

### GitHub (optional — I can do this if you run one command)

In terminal:
```
gh auth login
```
Choose: GitHub.com → HTTPS → Login with browser

---

## When done, tell Cursor exactly:

> **accounts connected, auto-finish**

Cursor will automatically:
1. Pull all secrets from Vercel
2. Push Postgres schema to Supabase
3. Redeploy production
4. Bootstrap all sync-enabled datasets
5. Run 18/18 verify checks
6. Set GitHub secrets (if `gh` is logged in)

Command used: `npm run auto-finish`

---

## What you do NOT need to do

- ❌ Copy DATABASE_URL manually (if Supabase integration connected)
- ❌ Copy Upstash URLs manually (if Upstash integration connected)
- ❌ Run setup-postgres yourself
- ❌ Run bootstrap yourself
- ❌ Redeploy yourself

## Already done for you

- ✅ App deployed: https://zonning.vercel.app
- ✅ CRON_SECRET, SESSION_SECRET, ADMIN_EMAILS, NEXT_PUBLIC_APP_URL
- ✅ Code hardened, ~200 tests pass
