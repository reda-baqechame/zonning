import { fetchWithRetry, type FetchRetryOptions } from "@/lib/http/resilience";
import { politeWait, recordOutcome } from "@/lib/http/politeness";

/**
 * Polite + resilient fetch for outbound data ingestion.
 *
 * Composes the politeness gate (per-host min interval + circuit breaker) with
 * the retry/backoff layer. Use this — not raw fetchWithRetry — for any
 * outbound request to Données Québec, ArcGIS, CanadaBuys, or municipal sites,
 * so the whole pipeline stays under each source's effective rate limit.
 */
export async function politeFetchWithRetry(
  input: string,
  init?: RequestInit,
  options?: FetchRetryOptions,
): Promise<Response> {
  await politeWait(input);
  const res = await fetchWithRetry(input, init, options);
  // Rate limits (429) are transient — do not trip the host circuit breaker.
  recordOutcome(input, res.ok || res.status === 429);
  return res;
}
