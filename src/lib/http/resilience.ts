export type FetchRetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  retryOn?: number[];
};

const DEFAULT_RETRY_ON = [408, 429, 500, 502, 503, 504];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<Response> {
  const retries = options?.retries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 500;
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const retryOn = options?.retryOn ?? DEFAULT_RETRY_ON;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, {
        ...init,
        cache: init?.cache ?? "no-store",
        signal: controller.signal,
      });

      if (res.ok || !retryOn.includes(res.status) || attempt === retries) {
        return res;
      }

      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : baseDelayMs * 2 ** attempt;
      await sleep(Math.min(delay, 30_000));
    } catch (e) {
      lastError = e;
      if (attempt === retries) throw e;
      await sleep(baseDelayMs * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("fetchWithRetry failed");
}
