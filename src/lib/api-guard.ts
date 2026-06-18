import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { getRequestId } from "@/lib/request-id";

export async function enforceRateLimit(
  req: NextRequest,
  key: string,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`${key}:${ip}`, limit, windowMs);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
  return null;
}

export function jsonWithRequestId(
  req: NextRequest,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  const requestId = getRequestId(req);
  const res = NextResponse.json(body, init);
  res.headers.set("x-request-id", requestId);
  return res;
}

export function apiError(
  req: NextRequest,
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse {
  return jsonWithRequestId(req, { error: message, ...extra }, { status });
}
