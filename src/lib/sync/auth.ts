import { NextRequest } from "next/server";

export function isSyncAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  // Dev / GitHub Actions fallback — not accepted in production
  if (process.env.NODE_ENV !== "production") {
    const cronHeader = req.headers.get("x-cron-secret");
    if (cronHeader === secret) return true;
  }

  return false;
}

export function assertSyncAuthorized(req: NextRequest): Response | null {
  if (!isSyncAuthorized(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}
