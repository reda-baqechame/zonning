import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:concierge:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    const request = await prisma.conciergeRequest.findUnique({
      where: { userId: user.id },
    });
    return NextResponse.json({ request });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
