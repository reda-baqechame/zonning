import { NextRequest, NextResponse } from "next/server";
import { resolveUpstashRestToken, resolveUpstashRestUrl } from "./env-resolve";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

async function upstashRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number } | null> {
  const base = resolveUpstashRestUrl();
  const token = resolveUpstashRestToken();
  if (!base || !token) return null;

  const windowSec = Math.ceil(windowMs / 1000);
  const redisKey = `rl:${key}`;

  try {
    const res = await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["TTL", redisKey],
      ]),
    });

    if (!res.ok) return null;
    const results = (await res.json()) as { result: number }[];
    const count = results[0]?.result ?? 1;
    const ttl = results[1]?.result ?? -1;

    if (ttl === -1) {
      await fetch(`${base}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (count > limit) {
      const retryAfterSec = ttl > 0 ? ttl : windowSec;
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  } catch {
    return null;
  }
}

/** Rate limiter with optional Upstash Redis in production. */
export async function rateLimitAsync(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const redis = await upstashRateLimit(key, limit, windowMs);
  if (redis) return redis;
  return rateLimit(key, limit, windowMs);
}

/** In-memory rate limiter (per key). Resets on cold start — use Redis in multi-instance prod. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded", retryAfterSec },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
