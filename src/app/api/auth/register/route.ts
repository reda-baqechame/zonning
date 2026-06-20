import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { verifyAndUpdateUserRbq } from "@/lib/rbq-verify";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().min(1).max(180).optional(),
  rbqLicenseClass: z.string().trim().max(80).optional(),
  rbqLicenseNumber: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  ampAuthorized: z.boolean().optional(),
  acceptTerms: z.boolean().refine((v) => v === true, { message: "Terms acceptance required" }),
});

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await rateLimitAsync(`auth:register:${ip}`, 5, 15 * 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const body = schema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        name: body.name,
        companyName: body.companyName,
        rbqLicenseClass: body.rbqLicenseClass,
        rbqLicenseNumber: body.rbqLicenseNumber,
        phone: body.phone,
        ampAuthorized: body.ampAuthorized ?? false,
      },
    });

    if (body.rbqLicenseNumber) {
      await verifyAndUpdateUserRbq(user.id, body.rbqLicenseNumber, body.rbqLicenseClass);
    }

    await createSession(user.id);
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
