import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPlanLimits } from "@/lib/plans";
import { computeVerifiedRbqFit } from "@/lib/rbq-verify";
import { computePipelineScore } from "@/lib/pipeline-score";
import { computeLeadSignals } from "@/lib/lead-signals";
import { ensureFreshForKey } from "@/lib/sync/auto";
import { matchesEssentielProfile, parseJsonArray } from "@/lib/usage";
import { createIntelligenceCache } from "@/lib/scoring/batch";
import { subDays } from "date-fns";
import { clientIp, rateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";
import { escapeCsvCell } from "@/lib/csv";
import { assessPermitQuality } from "@/lib/permits/quality";
import {
  buildPermitOpportunityDossier,
  buildTenderOpportunityDossier,
} from "@/lib/opportunities/dossier";
import { computeTenderScore } from "@/lib/tender-score";

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimitAsync(`api:export:${ip}`, 20, 60_000);
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  try {
    ensureFreshForKey("export");
    const user = await requireUser();
    const limits = getPlanLimits(user.plan);
    if (user.plan === "FREE") {
      return NextResponse.json(
        { error: "Export requires Essentiel plan or higher" },
        { status: 403 },
      );
    }

    const type = req.nextUrl.searchParams.get("type") ?? "permits";
    const since = subDays(new Date(), 90);
    const userTrades = parseJsonArray(user.trades);
    const userRegions = parseJsonArray(user.regions);

    if (type === "tenders") {
      const tenders = await prisma.tender.findMany({
        where: { closesAt: { gte: new Date() } },
        take: 500,
      });
      const filtered = tenders.filter((t) =>
        matchesEssentielProfile(user.plan, userTrades, userRegions, {
          title: t.title,
          region: t.region ?? undefined,
        }),
      );
      const header =
        "title,organization,region,closesAt,estimatedValue,score,confidence,nextAction,limitations,requiresAmp,sourceUrl\n";
      const rows = filtered
        .map((t) => {
          const ranking = computeTenderScore(t, {
            trades: userTrades,
            regions: userRegions,
            ampAuthorized: user.ampAuthorized,
            minProjectCost: user.minProjectCost,
            maxProjectCost: user.maxProjectCost,
          });
          const dossier = buildTenderOpportunityDossier({
            tender: t,
            score: ranking.score,
            signals: [],
            ranking,
          });
          return `${escapeCsvCell(t.title)},${escapeCsvCell(t.organization)},${escapeCsvCell(t.region)},${escapeCsvCell(t.closesAt?.toISOString())},${escapeCsvCell(t.estimatedValue)},${escapeCsvCell(dossier.score)},${escapeCsvCell(dossier.confidence)},${escapeCsvCell(dossier.nextAction)},${escapeCsvCell(dossier.limitations.join(" | "))},${escapeCsvCell(t.requiresAmp)},${escapeCsvCell(t.sourceUrl)}`;
        })
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

    const getIntel = limits.intelligenceFull ? createIntelligenceCache() : null;
    const eligibleOnly =
      req.nextUrl.searchParams.get("eligibleOnly") === "true";

    const enriched = await Promise.all(
      permits.map(async (p) => {
        const fit = computeVerifiedRbqFit(
          user.rbqLicenseClass,
          user.rbqLicenseNumber,
          user.rbqVerified,
          p.permitType,
          p.workType,
        );
        const dataQuality = assessPermitQuality(p);
        const intelligence = getIntel ? await getIntel(p) : undefined;
        const pipeline = await computePipelineScore(
          p,
          {
            rbqLicenseClass: user.rbqLicenseClass,
            rbqLicenseNumber: user.rbqLicenseNumber,
            rbqVerified: user.rbqVerified,
            minProjectCost: user.minProjectCost,
            maxProjectCost: user.maxProjectCost,
          },
          intelligence,
          { dataQualityScore: dataQuality.score },
        );
        const signals = computeLeadSignals(
          {
            kind: "permit",
            id: p.id,
            score: pipeline.score,
            permitType: p.permitType,
            address: p.address,
            borough: p.borough,
            city: p.city,
            estimatedCost: p.estimatedCost,
            issueDate: p.issueDate,
            rbqFit: fit,
            pipeline,
            intelligence,
          },
          {
            minProjectCost: user.minProjectCost,
            maxProjectCost: user.maxProjectCost,
            rbqVerified: user.rbqVerified,
          },
        );
        const dossier = buildPermitOpportunityDossier({
          permit: p,
          score: pipeline.score,
          signals,
          pipeline,
          dataQuality,
          intelligence,
        });
        return { p, fit, pipeline, signals, intelligence, dossier };
      }),
    );

    const filtered = enriched.filter(({ p, fit }) => {
      if (eligibleOnly && !fit.eligible) return false;
      return matchesEssentielProfile(user.plan, userTrades, userRegions, {
        trade: p.permitType,
        region: p.borough ?? p.city ?? undefined,
        borough: p.borough ?? undefined,
      });
    });

    const header =
      "permitType,address,borough,city,estimatedCost,issueDate,pipelineScore,confidence,nextAction,limitations,rbqFitScore,eligible,signals,gtcNearby,heritageNearby,rbqInfraction,inspectionFlag,sourceUrl\n";
    const rows = filtered
      .map(({ p, fit, pipeline, signals, intelligence, dossier }) =>
        [
          escapeCsvCell(p.permitType),
          escapeCsvCell(p.address),
          escapeCsvCell(p.borough),
          escapeCsvCell(p.city),
          escapeCsvCell(p.estimatedCost),
          escapeCsvCell(p.issueDate?.toISOString()),
          escapeCsvCell(pipeline.score),
          escapeCsvCell(dossier.confidence),
          escapeCsvCell(dossier.nextAction),
          escapeCsvCell(dossier.limitations.join(" | ")),
          escapeCsvCell(fit.score),
          escapeCsvCell(fit.eligible),
          escapeCsvCell(
            signals
              .slice(0, 3)
              .map((s) => s.id)
              .join("|"),
          ),
          escapeCsvCell(intelligence?.contamination?.gtcNearby ?? false),
          escapeCsvCell(intelligence?.heritage?.nearby ?? false),
          escapeCsvCell(intelligence?.rbqInfraction?.found ?? false),
          escapeCsvCell(intelligence?.municipalInspection?.found ?? false),
          escapeCsvCell(p.sourceUrl),
        ].join(","),
      )
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
