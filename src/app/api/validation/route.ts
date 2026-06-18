import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  interviewerName: z.string(),
  companyName: z.string(),
  role: z.string(),
  q1Pipeline: z.string().optional(),
  q2RbqPain: z.string().optional(),
  q3SeaoHours: z.string().optional(),
  q4WouldPay: z.string().optional(),
  wouldPayAmount: z.number().optional(),
  urgencyScore: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const interviews = await prisma.validationInterview.findMany({
    orderBy: { interviewedAt: "desc" },
  });

  const goCount = interviews.filter((i) => (i.urgencyScore ?? 0) >= 4).length;
  const payCount = interviews.filter(
    (i) => i.wouldPayAmount && i.wouldPayAmount >= 199
  ).length;

  return NextResponse.json({
    interviews,
    stats: {
      total: interviews.length,
      goCount,
      payCount,
      goCriteriaMet: goCount >= 8,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:validation:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = schema.parse(await req.json());
    const interview = await prisma.validationInterview.create({ data: body });
    return NextResponse.json({ interview });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
