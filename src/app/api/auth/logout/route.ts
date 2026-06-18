import { NextRequest, NextResponse } from "next/server";
import { destroySession, getSessionUser } from "@/lib/auth";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:logout:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const user = await getSessionUser();
  await destroySession();
  return NextResponse.json({ ok: true, userId: user?.id ?? null });
}
