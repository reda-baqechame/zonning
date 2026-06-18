import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePaymentDeadlines } from "@/lib/paiement-public/deadlines";
import { z } from "zod";
import { rateLimitAsync, rateLimitResponse, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  title: z.string().min(1),
  awardDate: z.string().optional(),
  invoiceDate: z.string().optional(),
  paymentDue: z.string().optional(),
  amount: z.number().optional(),
  notes: z.string().optional(),
  tenderAwardId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const ip = clientIp(req);
    const limited = await rateLimitAsync(`api:paiement:${user.id}:${ip}`, 40, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const rows = await prisma.publicContractPayment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const contracts = await Promise.all(
      rows.map(async (c) => {
        const award = c.tenderAwardId
          ? await prisma.tenderAward.findUnique({ where: { id: c.tenderAwardId } })
          : null;
        const deadlines = c.awardDate
          ? computePaymentDeadlines(c.awardDate, c.amount)
          : null;
        return {
          ...c,
          deadlines,
          award: award
            ? {
                id: award.id,
                title: award.title,
                sourceUrl: award.sourceUrl,
                awardAmount: award.awardAmount,
                awardDate: award.awardDate,
              }
            : null,
        };
      })
    );

    const recentAwards = await prisma.tenderAward.findMany({
      orderBy: { awardDate: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        winnerName: true,
        awardAmount: true,
        awardDate: true,
        sourceUrl: true,
      },
    });

    return NextResponse.json({ contracts, recentAwards });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const ip = clientIp(req);
    const limited = await rateLimitAsync(`api:paiement:${user.id}:${ip}`, 20, 60_000);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const body = schema.parse(await req.json());

    let awardDate = body.awardDate ? new Date(body.awardDate) : null;
    let amount = body.amount;
    let title = body.title;
    let tenderAwardId = body.tenderAwardId ?? null;

    if (body.tenderAwardId) {
      const award = await prisma.tenderAward.findUnique({
        where: { id: body.tenderAwardId },
      });
      if (award) {
        title = award.title ?? title;
        amount = award.awardAmount ?? amount;
        awardDate = award.awardDate ?? awardDate;
        tenderAwardId = award.id;
      }
    }

    const deadlines = awardDate ? computePaymentDeadlines(awardDate, amount) : null;

    const contract = await prisma.publicContractPayment.create({
      data: {
        userId: user.id,
        title,
        awardDate,
        invoiceDate: body.invoiceDate
          ? new Date(body.invoiceDate)
          : deadlines?.invoiceDue ?? null,
        paymentDue: body.paymentDue
          ? new Date(body.paymentDue)
          : deadlines?.paymentDue ?? null,
        amount,
        notes: body.notes ?? deadlines?.notesFr,
        tenderAwardId,
      },
    });

    return NextResponse.json({ contract, deadlines });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
