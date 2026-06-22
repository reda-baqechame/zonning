import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expandSearchTerms } from "@/lib/datasets/registry";
import { enforceRateLimit } from "@/lib/api-guard";
import { clampQuery } from "@/lib/query-params";

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, "api:companies", 60, 60_000);
  if (limited) return limited;

  const { searchParams } = req.nextUrl;
  const q = clampQuery(searchParams.get("q"), 80);
  const sector = clampQuery(searchParams.get("sector"), 60);
  const region = clampQuery(searchParams.get("region"), 60);
  const cert = clampQuery(searchParams.get("certification"), 60);

  const searchTerms = q ? expandSearchTerms(q) : [];

  const companies = await prisma.company.findMany({
    where: {
      AND: [
        searchTerms.length
          ? {
              OR: searchTerms.flatMap((term) => [
                { name: { contains: term } },
                { capabilities: { contains: term } },
                { sector: { contains: term } },
                { certifications: { contains: term } },
              ]),
            }
          : {},
        sector ? { sector: { contains: sector } } : {},
        region ? { region: { contains: region } } : {},
        cert ? { certifications: { contains: cert } } : {},
      ],
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  const enriched = await Promise.all(
    companies.map(async (c) => {
      const nameNeedle = c.name.slice(0, 20);
      const [seaoAwards, rbq] = await Promise.all([
        prisma.tenderAward.findMany({
          where: {
            OR: [
              { winnerName: { contains: nameNeedle } },
              ...(c.neq ? [{ winnerName: { contains: c.neq } }] : []),
            ],
          },
          orderBy: { awardDate: "desc" },
          take: 3,
          select: {
            title: true,
            awardAmount: true,
            awardDate: true,
            contractStatus: true,
            finalValue: true,
          },
        }),
        c.neq
          ? prisma.rbqLicense.findFirst({ where: { licenseNumber: c.neq } })
          : prisma.rbqLicense.findFirst({
              where: { holderName: { contains: nameNeedle } },
            }),
      ]);
      return {
        ...c,
        seaoAwards,
        rbqLicense: rbq
          ? { licenseNumber: rbq.licenseNumber, status: rbq.status, subclass: rbq.subclass }
          : null,
      };
    })
  );

  const suppliersOnly = searchParams.get("suppliers") === "true";
  if (suppliersOnly) {
    const suppliers = await prisma.municipalSupplier.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { neq: { contains: q } },
              { borough: { contains: q } },
            ],
          }
        : {},
      orderBy: { name: "asc" },
      take: 100,
    });
    return NextResponse.json({ companies: enriched, suppliers });
  }

  return NextResponse.json({ companies: enriched });
}
