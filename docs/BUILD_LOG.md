# ZONNING Build Log

Public development journal — **Built with Cursor**.

See live version: `/fr/build-log`

## 2026-06-18 — Enterprise hardening + gap closure

- Production env validation, circuit breaker, HTTP retries, distributed sync lock
- Rate limits on permits/feed/intelligence; admin emails fail-closed in prod
- Geocoding for PERMIS.AI Verdict (permit registry + OSM fallback)
- ChantierRadar: 10-city filter, GTC/LPC badges, permit-type filter
- Dashboard coverage SLA panel; verify-deploy expanded (12 checks)
- GitHub Actions mirrors full Vercel cron set (alerts, stats, thursday)
- Dataset count aligned to **33** (excludes legacy `zoning` + optional Toronto)

## 2026-04-01 — Full Government Data Build (33 datasets)

- Montreal + ArcGIS adapters; PUM 2050 zoning, provincial GTC, LPC heritage
- Geographic expansion: Sherbrooke, Trois-Rivières, Saguenay, Lévis/Brossard scaffolds
- SEAO amendments + completed contracts; borough contracts dataset
- SiteIntelligence layers; Pipeline Score v2; coverage dashboard on `/api/sync/health`
- Webhook per-org filters; `EXPAND_ONTARIO` Toronto scaffold

## 2026-06-29 — Moat Hardening + GTM

- **22 datasets** with quality gates (`DatasetQualityCheck`), zoning synthetic fallback removed
- Permit date-window pagination; `persistSourceMetadata` on all sync paths
- Signed session cookies (`SESSION_SECRET`), Redis-ready `rateLimitAsync`, Sentry wrap
- Équipe webhooks UI + dispatcher; verdict share OG + referrer tracking
- HomeStats freshness (`permitsLastSuccessAt`); `/api/cron/stats`; cookie consent + CASL flag
- Vitest (11 tests) + CI Postgres validation (`db push`)

## 2026-06-18 — Industry Standard (ZONNING + PERMIS.AI)

- **Feed** Command Center: unified permits + SEAO tabs, settings hub, post-register onboarding
- **PERMIS.AI**: public `/verdict`, `VerdictReport` model, share slugs, OG images, deterministic tiers
- Permit AI summaries (FR/EN) batched after sync
- MarchésQC: countdown hours, AMP badges, similar awards panel
- **Équipe** hub: invites, API keys, 5-seat cap, webhooks
- Admin concierge delivery API + dashboard panel
- Paiement public: SEAO award linking + QC 2025 deadline engine
- PartenairesCA: COR/ISO filter chips + SEAO award cross-links
- Homepage: feed + verdict hero, Cursor case study section

## 2026-06-18 — Complete Build

- Production: Stripe webhooks, ops dashboard, verify-deploy (33 datasets + allowlist)
- Intelligence: RBQ registry verification, Pipeline Score, AI tender summaries
- Alerts: Twilio SMS, Thursday SEAO cron, Essentiel trade/region limits
- Revenue: Organizations, API v1, CRM export, Concierge workflow
- Geography: Laval + Longueuil permit datasets
- Phase 3: Prompt-payment tracker and density-gap analysis
- GTM: Live stats homepage, digest signup, build log

## 2026-06-18 — Gap Closure

- Email alerts (Resend), plan gating, Registre sync, SEAO awards, zoning lite

## 2026-06-18 — MVP

- Four modules, 11 datasets, cron sync, Stripe, bilingual UI
