import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const demoSchema = z.object({
  interviewerName: z.string().min(1),
  companyName: z.string().min(1),
  role: z.string().min(1),
  q1Pipeline: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:validation-demo:${ip}`, 5, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const body = demoSchema.parse(await req.json());
    const interview = await prisma.validationInterview.create({
      data: {
        ...body,
        urgencyScore: 3,
        notes: "Demo request (public form)",
      },
    });
    return NextResponse.json({ ok: true, id: interview.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
