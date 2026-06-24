import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPermitOpportunityDossier } from "@/lib/opportunities/dossier";
import { assessPermitQuality } from "@/lib/permits/quality";
import { computePipelineScore } from "@/lib/pipeline-score";
import { batchCompetitionCounts } from "@/lib/scoring/batch";
import { computeLeadSignals } from "@/lib/lead-signals";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnostic. Runs the exact enrichment path used by /api/permits
 * on one permit and reports the latitude at each stage, so we can see WHERE
 * it flips from a correct decimal to a mangled integer. DELETE after debugging.
 */
export async function GET() {
  const permits = await prisma.permit.findMany({
    where: { city: "Québec", latitude: { not: null } },
    take: 1,
    orderBy: { issueDate: "desc" },
  });
  const p = permits[0];
  if (!p) return NextResponse.json({ found: false });

  const stage1 = p.latitude;
  const competitionMap = await batchCompetitionCounts(permits);
  const stage2 = p.latitude;
  const dataQuality = assessPermitQuality(p);
  const stage3 = p.latitude;
  const signals = computeLeadSignals({ kind: "permit", permit: p });
  const stage4 = p.latitude;
  const pipeline = computePipelineScore({
    kind: "permit",
    permit: p,
    competition: competitionMap.get(p.id) ?? 0,
  });
  const stage5 = p.latitude;
  const dossier = buildPermitOpportunityDossier({
    permit: p,
    score: pipeline.score,
    signals,
    pipeline,
    dataQuality,
    locale: "fr",
  });
  const stage6 = p.latitude;
  const serialized = JSON.parse(JSON.stringify({ permit: p, dossier }));
  const stage7 = serialized.permit.latitude;

  return NextResponse.json({
    id: p.id,
    stages: {
      "0_afterQuery": stage1,
      "1_afterCompetition": stage2,
      "2_afterQuality": stage3,
      "3_afterSignals": stage4,
      "4_afterPipeline": stage5,
      "5_afterDossier": stage6,
      "6_afterSerialize": stage7,
    },
    dossierLatitude: (dossier as { permit?: { latitude?: number } }).permit?.latitude,
  });
}
