import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { toPublicUser } from "@/lib/user-dto";
import { enforceRateLimit } from "@/lib/api-guard";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:auth-me", 120, 60_000);
  if (limited) return limited;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: toPublicUser(user) });
}
