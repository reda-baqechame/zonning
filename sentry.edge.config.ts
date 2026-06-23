// Optional Sentry (edge runtime) — set SENTRY_DSN in production.
// Mirrors sentry.server.config.ts for the Edge runtime used by middleware
// and edge API routes.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}
