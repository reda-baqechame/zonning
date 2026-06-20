import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const requestSchema = z.object({
  interviewerName: z.string().trim().min(1).max(120),
  companyName: z.string().trim().min(1).max(180),
  role: z.string().trim().min(1).max(120),
  q1Pipeline: z.string().trim().max(3000).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:validation-intake:${ip}`, 5, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = requestSchema.parse(await req.json());
    const interview = await prisma.validationInterview.create({
      data: {
        ...body,
        urgencyScore: null,
        notes: "Public onboarding request; urgency has not been assessed.",
      },
    });
    return NextResponse.json({ ok: true, id: interview.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
