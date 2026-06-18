import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanLimits } from "@/lib/plans";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { subDays } from "date-fns";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

function escapeCsv(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:export:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    ensureFreshForKey("export");
    const user = await requireUser();
    const limits = getPlanLimits(user.plan);
    if (!limits.complianceVault && user.plan !== "ESSENTIEL") {
      return NextResponse.json({ error: "Export requires Essentiel plan or higher" }, { status: 403 });
    }

    const type = req.nextUrl.searchParams.get("type") ?? "permits";
    const since = subDays(new Date(), 90);

    if (type === "tenders") {
      const tenders = await prisma.tender.findMany({
        where: { closesAt: { gte: new Date() } },
        take: 500,
      });
      const header = "title,organization,region,closesAt,estimatedValue,sourceUrl\n";
      const rows = tenders
        .map(
          (t) =>
            `${escapeCsv(t.title)},${escapeCsv(t.organization)},${escapeCsv(t.region)},${escapeCsv(t.closesAt?.toISOString())},${escapeCsv(t.estimatedValue)},${escapeCsv(t.sourceUrl)}`
        )
        .join("\n");
      return new NextResponse(header + rows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="zonning-tenders.csv"',
        },
      });
    }

    const permits = await prisma.permit.findMany({
      where: { issueDate: { gte: since } },
      take: 500,
    });

    const header =
      "permitType,address,borough,city,estimatedCost,issueDate,rbqFitScore,eligible,sourceUrl\n";
    const rows = permits
      .map((p) => {
        const fit = computeVerifiedRbqFit(
          user.rbqLicenseClass,
          user.rbqLicenseNumber,
          user.rbqVerified,
          p.permitType,
          p.workType
        );
        return `${escapeCsv(p.permitType)},${escapeCsv(p.address)},${escapeCsv(p.borough)},${escapeCsv(p.city)},${escapeCsv(p.estimatedCost)},${escapeCsv(p.issueDate?.toISOString())},${fit.score},${fit.eligible},${escapeCsv(p.sourceUrl)}`;
      })
      .filter((row) => {
        const eligible = row.split(",")[7] === "true";
        return req.nextUrl.searchParams.get("eligibleOnly") !== "true" || eligible;
      })
      .join("\n");

    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="zonning-permits.csv"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
