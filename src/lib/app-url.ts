/**
 * Resolve the public app URL, failing closed in production.
 *
 * Previously several routes fell back to `http://localhost:3000` when
 * NEXT_PUBLIC_APP_URL was unset — a redirect/open-redirect risk in prod
 * (Stripe success URLs, billing portal return URLs, report links). This helper
 * refuses to return localhost in production so misconfig surfaces immediately
 * instead of silently redirecting users off-domain.
 */
export function appUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not configured in production. Redirects would target localhost — refusing. Set NEXT_PUBLIC_APP_URL to the public https URL."
    );
  }

  return "http://localhost:3000";
}
