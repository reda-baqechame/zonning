/**
 * Outbound politeness gate.
 *
 * Enforces a minimum interval between requests to the same host so ZONNING's
 * ingestion stays a well-behaved client of Quebec's open-data portals and
 * municipal sites. This is the legal/ethical backbone for the data pipeline:
 * it keeps ZONNING under each source's effective rate limit and away from any
 * behaviour that could read as abuse.
 *
 * Honors Retry-After (handled by fetchWithRetry) and a per-host floor of
 * `minIntervalMs`. Per-host circuit breakers trip after consecutive failures.
 */

const hostState = new Map<
  string,
  { lastRequestAt: number; consecutiveFailures: number; openUntil: number }
>();

/** Default minimum gap between requests to the same host (1 req/sec). */
const DEFAULT_MIN_INTERVAL_MS = 1000;
/** Trip a host circuit after this many consecutive failures. */
const CIRCUIT_FAILURE_THRESHOLD = 5;
/** How long a tripped host stays open before a probe is allowed. */
const CIRCUIT_OPEN_MS = 60_000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return url;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Wait until enough time has elapsed since the last request to `url`'s host.
 * Throws if the host circuit is open (too many consecutive failures).
 */
export async function politeWait(
  url: string,
  minIntervalMs: number = DEFAULT_MIN_INTERVAL_MS,
): Promise<void> {
  const host = hostOf(url);
  const state = hostState.get(host);

  if (state && state.openUntil > Date.now()) {
    throw new Error(
      `Politeness circuit open for host ${host} (too many consecutive failures). Retry later.`,
    );
  }

  if (state) {
    const elapsed = Date.now() - state.lastRequestAt;
    const wait = minIntervalMs - elapsed;
    if (wait > 0) await sleep(wait);
  }

  const existing = hostState.get(host) ?? {
    lastRequestAt: 0,
    consecutiveFailures: 0,
    openUntil: 0,
  };
  hostState.set(host, { ...existing, lastRequestAt: Date.now() });
}

/**
 * Record the outcome of a request so the circuit breaker can react. Call this
 * after every outbound fetch: `recordOutcome(url, res.ok)`.
 */
export function recordOutcome(url: string, ok: boolean): void {
  const host = hostOf(url);
  const state =
    hostState.get(host) ?? {
      lastRequestAt: 0,
      consecutiveFailures: 0,
      openUntil: 0,
    };
  if (ok) {
    state.consecutiveFailures = 0;
    state.openUntil = 0;
  } else {
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      state.openUntil = Date.now() + CIRCUIT_OPEN_MS;
    }
  }
  hostState.set(host, state);
}

/** Test helper: reset all host state. */
export function resetPolitenessForTests(): void {
  hostState.clear();
}

/** Read the current min interval (test seam). */
export const POLITENESS_MIN_INTERVAL_MS = DEFAULT_MIN_INTERVAL_MS;
