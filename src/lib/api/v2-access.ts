import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { validateApiKey } from "@/lib/api-auth";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

export type V2Access =
  | { kind: "session"; principalId: string }
  | { kind: "api_key"; principalId: string };

export async function requireV2Access(
  req: NextRequest,
  scope: "permits" | "tenders" | "verdict",
): Promise<V2Access | NextResponse> {
  const apiKey = await validateApiKey(req.headers.get("authorization"), scope);
  if (apiKey) {
    return { kind: "api_key", principalId: apiKey.orgId };
  }

  const user = await getSessionUser();
  if (user) {
    return { kind: "session", principalId: user.id };
  }

  return NextResponse.json(
    { error: `Authentication required. Use a signed session or a Bearer API key with the ${scope} scope.` },
    { status: 401 },
  );
}

export async function enforceV2RateLimit(
  req: NextRequest,
  route: string,
  access: V2Access,
  limit: number,
  windowMs = 60_000,
): Promise<NextResponse | null> {
  const key = `api:v2:${route}:${access.kind}:${access.principalId}:${clientIp(req)}`;
  const limited = await rateLimitAsync(key, limit, windowMs);
  return limited.ok ? null : rateLimitResponse(limited.retryAfterSec);
}

export function isV2Access(value: V2Access | NextResponse): value is V2Access {
  return !(value instanceof NextResponse);
}
