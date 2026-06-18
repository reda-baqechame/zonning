import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { generateComplianceCertificatePdf } from "@/lib/casl-pdf";
import { getPlanLimits } from "@/lib/plans";
import { z } from "zod";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const createSchema = z.object({
  contactName: z.string(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  sourceType: z.string(),
  sourceUrl: z.string().url(),
  sourceFetchedAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:compliance:get:${ip}`, 40, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");

  if (id) {
    try {
      const user = await requireUser();
      const limits = getPlanLimits(user.plan);
      if (!limits.complianceVault) {
        return NextResponse.json(
          { error: "Compliance Vault requires Pro plan or higher." },
          { status: 403 }
        );
      }

      const record = await prisma.complianceRecord.findFirst({
        where: { id, userId: user.id },
      });
      if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const pdf = generateComplianceCertificatePdf({
        contactName: record.contactName,
        contactEmail: record.contactEmail,
        contactPhone: record.contactPhone,
        sourceType: record.sourceType,
        sourceUrl: record.sourceUrl,
        sourceFetchedAt: record.sourceFetchedAt,
        lawfulBasis: record.lawfulBasis,
        issuedBy: user.name ?? user.email,
        companyName: user.companyName,
      });

      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="zonning-casl-${id}.pdf"`,
        },
      });
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const user = await requireUser();
    const records = await prisma.complianceRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:compliance:${ip}`, 30, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    const user = await requireUser();
    const limits = getPlanLimits(user.plan);
    if (!limits.complianceVault) {
      return NextResponse.json(
        { error: "Compliance Vault requires Pro plan or higher." },
        { status: 403 }
      );
    }

    const body = createSchema.parse(await req.json());

    const record = await prisma.complianceRecord.create({
      data: {
        userId: user.id,
        contactName: body.contactName,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        sourceType: body.sourceType,
        sourceUrl: body.sourceUrl,
        sourceFetchedAt: body.sourceFetchedAt
          ? new Date(body.sourceFetchedAt)
          : new Date(),
        lawfulBasis: "conspicuous_publication",
        certificateIssuedAt: new Date(),
      },
    });

    return NextResponse.json({ record });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
