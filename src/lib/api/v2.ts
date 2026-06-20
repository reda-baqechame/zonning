import { prisma } from "@/lib/prisma";
import { getIntelligenceByAddress, type PropertyIntelligence } from "@/lib/intelligence";
import { computeVerdictTier } from "@/lib/verdict/compute-verdict";
import { fetchMarketPulseStats } from "@/lib/market-pulse";
import { DATASETS, getRegisteredDatasetIds, getSyncEnabledDatasetIds } from "@/lib/datasets/registry";
import { evidence, type Evidence, type Opportunity, type SiteDossier, type SourceRef } from "@/lib/domain/quebec";
import { buildZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";
import type { ZoningProjectInput } from "@/lib/zoning/expert-analysis";
import type { ZoningExpertAnalysis } from "@/lib/zoning/expert-analysis";
import { addressMatchesCandidate } from "@/lib/geocode";
import { normalizeAddress } from "@/lib/datasets/parser";

export const API_VERSION = "v2";

export function sourceFromDataset(datasetId: keyof typeof DATASETS): SourceRef {
  const cfg = DATASETS[datasetId];
  return {
    id: datasetId,
    title: cfg.label,
    url: cfg.sourceUrl,
    publisher: cfg.ckanHost === "montreal" ? "Ville de Montreal" : "Donnees Quebec / source publique",
  };
}

export async function findSitePermitEvents(
  address: string,
  city?: string | null,
  limit = 25,
): Promise<SiteDossier["permits"]> {
  const normalized = normalizeAddress(address);
  const streetNeedle = normalized.split(" ").slice(1).join(" ").slice(0, 20);
  if (!streetNeedle && normalized.length < 5) return [];

  const candidates = await prisma.permit.findMany({
    where: {
      address: { contains: streetNeedle || normalized.slice(0, 20) },
      ...(city ? { city } : {}),
    },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(limit * 4, 40), 200),
  });

  return candidates
    .filter((permit) => addressMatchesCandidate(address, permit.address))
    .slice(0, limit)
    .map((permit) => {
      const source: SourceRef = {
        id: `permit-${permit.id}`,
        title: "Municipal permit source",
        url: permit.sourceUrl,
        observedAt: permit.issueDate?.toISOString(),
        refreshedAt: permit.sourceFetchedAt.toISOString(),
      };
      return {
        id: permit.id,
        stage: "issuance" as const,
        title: permit.permitType,
        municipality: permit.city,
        address: permit.address,
        value: permit.estimatedCost,
        date: permit.issueDate?.toISOString() ?? null,
        participants: [permit.applicantName].filter((name): name is string => Boolean(name)),
        documents: [source],
        confidence: permit.sourceUrl && permit.issueDate ? 0.82 : permit.sourceUrl ? 0.65 : 0.35,
        source,
      };
    });
}

function hasContaminationSignal(intel: PropertyIntelligence): boolean {
  const value = intel.contamination;
  return Boolean(
    value &&
      (value.nearby || value.gtcNearby || (value.count ?? 0) > 0 || (value.gtcCount ?? 0) > 0),
  );
}

function hasHeritageSignal(intel: PropertyIntelligence): boolean {
  const value = intel.heritage;
  return Boolean(
    value &&
      (value.nearby || value.hasEip || value.lpcProtected || value.pum2050Listed || value.count > 0),
  );
}

function hasRoadworkSignal(intel: PropertyIntelligence): boolean {
  return Boolean(intel.roadworks && (intel.roadworks.nearby || intel.roadworks.count > 0));
}

export function summarizeSiteEvidence(
  intel: PropertyIntelligence,
  permits: SiteDossier["permits"],
  zoningAnalysis: ZoningExpertAnalysis,
): SiteDossier["evidenceSummary"] {
  const parcelZoning =
    intel.zoning?.evidenceScope === "parcel" && zoningAnalysis.status === "confirmed";
  const parcelSignals = [
    Boolean(intel.assessment),
    Boolean(intel.recentTransaction),
    Boolean(intel.propertyTax),
    parcelZoning,
  ].filter(Boolean).length;
  const contextualSignals = [
    hasContaminationSignal(intel),
    hasHeritageSignal(intel),
    hasRoadworkSignal(intel),
    Boolean(intel.marketHeat),
    Boolean(intel.developmentProjects?.nearby),
    Boolean(intel.permitDelays),
    Boolean(intel.zoning && !parcelZoning),
  ].filter(Boolean).length;
  const directUnits = parcelSignals + Math.min(2, permits.length);
  let decisionConfidence = 0;
  if (directUnits > 0) {
    decisionConfidence = Math.min(0.85, 0.42 + directUnits * 0.09);
  } else if (contextualSignals > 0) {
    decisionConfidence = Math.min(0.35, 0.15 + contextualSignals * 0.05);
  }
  if (parcelZoning) {
    decisionConfidence = Math.max(decisionConfidence, zoningAnalysis.confidence / 100);
  }

  return {
    parcelSignals,
    addressMatchedPermits: permits.length,
    contextualSignals,
    decisionConfidence,
    canIssueParcelConclusion: zoningAnalysis.canConcludeCompliance,
  };
}

function sourceFromZoning(intel: NonNullable<Awaited<ReturnType<typeof getIntelligenceByAddress>>["zoning"]>): SourceRef {
  const fallback = intel.source === "pum2050" ? sourceFromDataset("pum2050-zoning") : null;
  return {
    id: `zoning-${intel.source ?? "unknown"}`,
    title: intel.description || intel.zoneCode || fallback?.title || "Municipal zoning source",
    url: intel.sourceUrl || fallback?.url || "",
    publisher: fallback?.publisher,
    refreshedAt: intel.sourceFetchedAt ?? undefined,
  };
}

export async function buildSiteDossier(input: {
  id?: string;
  address: string;
  city?: string | null;
  borough?: string | null;
  project?: ZoningProjectInput;
}): Promise<SiteDossier> {
  const [intel, permits] = await Promise.all([
    getIntelligenceByAddress(
      input.address,
      input.borough ?? undefined,
      input.city ?? undefined,
    ),
    findSitePermitEvents(input.address, input.city),
  ]);
  const verdict = computeVerdictTier(intel);
  const zoningAnalysis = buildZoningExpertAnalysis(intel, input.project);
  const evidenceSummary = summarizeSiteEvidence(intel, permits, zoningAnalysis);
  const hasDirectEvidence =
    evidenceSummary.parcelSignals > 0 || evidenceSummary.addressMatchedPermits > 0;
  const hasContext = evidenceSummary.contextualSignals > 0;

  const signals: Evidence<unknown>[] = [];
  if (intel.assessment) {
    signals.push(evidence(intel.assessment, sourceFromDataset("mamh-assessment-rolls"), 0.65, verdict.limitations));
  }
  if (intel.zoning) {
    signals.push(
      evidence(
        intel.zoning,
        sourceFromZoning(intel.zoning),
        zoningAnalysis.confidence / 100,
        verdict.limitations,
      ),
    );
  }
  if (intel.propertyTax) signals.push(evidence(intel.propertyTax, sourceFromDataset("taxes"), 0.6, []));
  if (hasContaminationSignal(intel)) signals.push(evidence(intel.contamination, sourceFromDataset("contamination-gtc"), 0.7, []));
  if (hasHeritageSignal(intel)) signals.push(evidence(intel.heritage, sourceFromDataset("heritage"), 0.55, []));
  if (hasRoadworkSignal(intel)) signals.push(evidence(intel.roadworks, sourceFromDataset("roadworks"), 0.5, []));
  if (intel.marketHeat) signals.push(evidence(intel.marketHeat, sourceFromDataset("permit-stats"), 0.45, []));
  if (intel.recentTransaction) signals.push(evidence(intel.recentTransaction, sourceFromDataset("transactions"), 0.45, []));
  if (intel.developmentProjects) signals.push(evidence(intel.developmentProjects, sourceFromDataset("projects-sherbrooke"), 0.4, []));

  const constraints: Evidence<unknown>[] = [];
  if (hasContaminationSignal(intel)) constraints.push(evidence(intel.contamination, sourceFromDataset("contamination-gtc"), 0.7, []));
  if (hasHeritageSignal(intel)) constraints.push(evidence(intel.heritage, sourceFromDataset("heritage"), 0.55, []));
  if (hasRoadworkSignal(intel)) constraints.push(evidence(intel.roadworks, sourceFromDataset("roadworks"), 0.45, []));

  return {
    id: input.id ?? `site_${Buffer.from(input.address).toString("base64url").slice(0, 18)}`,
    address: input.address,
    municipality: input.city ?? null,
    coverageStatus: hasDirectEvidence ? "partial" : hasContext ? "context_only" : "unavailable",
    verdict: verdict.tier,
    signals,
    zoningAnalysis,
    constraints,
    permits,
    evidenceSummary,
    limitations: [
      ...verdict.limitations,
      ...(!hasDirectEvidence && hasContext
        ? ["Nearby contextual records were found, but none is tied to the subject parcel or civic address."]
        : []),
      ...(!hasDirectEvidence && !hasContext
        ? ["No verified property intelligence matched this address in the currently indexed datasets."]
        : []),
      "Operational intelligence only. This is not authorization, legal advice, or a municipal filing.",
      "Municipal zoning bylaws are integrated only where a verified source exists; otherwise the endpoint returns limitations.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function buildOpportunities(limit = 25): Promise<Opportunity[]> {
  const now = new Date();
  const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();
  const scoreDecision = (score: number, hasDeadline: boolean): Opportunity["bidDecision"] => {
    if (score >= 2.25) return "bid";
    if (score >= 1.55) return hasDeadline ? "review" : "watch";
    return "no_bid";
  };
  const scoreReason = (score: number, confidence: number) => {
    if (score >= 2.25 && confidence >= 0.7) return "Strong timing, value, source confidence and trade-fit signals.";
    if (score >= 1.55) return "Worth reviewing, but source documents or fit need confirmation.";
    return "Weak evidence or low-fit signal; monitor unless it matches a strategic account.";
  };
  const [permits, tenders] = await Promise.all([
    prisma.permit.findMany({
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
      take: Math.min(limit, 50),
    }),
    prisma.tender.findMany({
      where: { OR: [{ closesAt: { gte: now } }, { closesAt: null }] },
      orderBy: [{ closesAt: "asc" }, { publishedAt: "desc" }],
      take: Math.min(limit, 50),
    }),
  ]);

  const permitOps: Opportunity[] = permits.map((p) => {
    const timingScore = p.issueDate ? 0.8 : 0.45;
    const valueScore = p.estimatedCost ? Math.min(1, p.estimatedCost / 1_000_000) : 0.25;
    const tradeFitScore = p.requiredRbqClasses ? 0.75 : 0.35;
    const confidence = p.sourceUrl ? 0.75 : 0.4;
    const total = timingScore + valueScore + tradeFitScore + confidence;
    const source = {
      id: "permit",
      title: "Municipal permit",
      url: p.sourceUrl,
      observedAt: p.issueDate?.toISOString(),
    };
    const checklist: Opportunity["permitChecklist"] = [
      { label: "Municipality source opened", status: p.sourceUrl ? "ready" : "missing" },
      { label: "RBQ class fit checked", status: p.requiredRbqClasses ? "ready" : "review" },
      { label: "Applicant/contact identified", status: p.applicantName ? "ready" : "review" },
      { label: "Comparable permit value reviewed", status: p.estimatedCost ? "ready" : "missing" },
    ];
    return {
      id: `permit_${p.id}`,
      type: "permit",
      title: p.permitType,
      municipality: p.city,
      value: p.estimatedCost,
      deadline: null,
      stage: p.issueDate ? "construction_start" : "permit_research",
      bidDecision: scoreDecision(total, false),
      bidDecisionReason: scoreReason(total, confidence),
      actionDueAt: inDays(confidence >= 0.7 ? 2 : 5),
      timingScore,
      valueScore,
      tradeFitScore,
      confidence,
      recommendedNextAction: "Verify scope, RBQ class fit, applicant and comparable permit value before outreach.",
      newSince: p.issueDate?.toISOString() ?? p.createdAt.toISOString(),
      contacts: p.applicantName
        ? [{ role: "applicant", name: p.applicantName, confidence: 0.66 }]
        : [{ role: "municipality", name: p.city ?? "Municipal registry", confidence: 0.45 }],
      documents: [source],
      permitChecklist: checklist,
      crmReady: Boolean(p.sourceUrl && (p.applicantName || p.city)),
      source,
      limitations: ["Permit stage and participant fields vary by municipality."],
    };
  });

  const tenderOps: Opportunity[] = tenders.map((t) => {
    const daysLeft = t.closesAt ? Math.ceil((t.closesAt.getTime() - now.getTime()) / 86_400_000) : null;
    const timingScore = t.closesAt ? (daysLeft != null && daysLeft <= 7 ? 0.95 : 0.82) : 0.4;
    const valueScore = t.estimatedValue ? Math.min(1, t.estimatedValue / 1_500_000) : 0.35;
    const tradeFitScore = t.unspsc ? 0.65 : 0.4;
    const confidence = t.sourceUrl ? 0.8 : 0.45;
    const total = timingScore + valueScore + tradeFitScore + confidence;
    const source = {
      id: "seao",
      title: "SEAO tender",
      url: t.sourceUrl,
      observedAt: t.publishedAt?.toISOString(),
    };
    return {
      id: `tender_${t.id}`,
      type: "tender",
      title: t.title,
      municipality: t.region,
      value: t.estimatedValue,
      deadline: t.closesAt?.toISOString() ?? null,
      stage: t.closesAt ? "bidding" : "award_watch",
      bidDecision: scoreDecision(total, Boolean(t.closesAt)),
      bidDecisionReason: scoreReason(total, confidence),
      actionDueAt: t.closesAt?.toISOString() ?? inDays(3),
      timingScore,
      valueScore,
      tradeFitScore,
      confidence,
      recommendedNextAction: t.closesAt ? "Review SEAO documents, confirm addenda, assign estimator, and decide bid/no-bid." : "Monitor amendments and buyer documents.",
      newSince: t.publishedAt?.toISOString() ?? null,
      contacts: t.organization
        ? [{ role: "buyer", name: t.organization, confidence: 0.78 }]
        : [{ role: "unknown", name: "Buyer not normalized", confidence: 0.25 }],
      documents: [source],
      permitChecklist: [
        { label: "Official SEAO notice opened", status: t.sourceUrl ? "ready" : "missing" },
        { label: "Addenda checked", status: t.status === "amended" ? "review" : "ready" },
        { label: "Deadline assigned", status: t.closesAt ? "ready" : "missing" },
        { label: "AMP/RBQ requirements reviewed", status: t.requiresAmp || t.unspsc ? "review" : "missing" },
      ],
      crmReady: Boolean(t.sourceUrl && t.organization),
      source,
      limitations: ["SEAO documents and addenda should be checked on the official source before action."],
    };
  });

  return [...permitOps, ...tenderOps]
    .sort((a, b) => b.timingScore + b.valueScore + b.tradeFitScore + b.confidence - (a.timingScore + a.valueScore + a.tradeFitScore + a.confidence))
    .slice(0, limit);
}

export async function buildCoveragePayload() {
  const stats = await fetchMarketPulseStats();
  return {
    version: API_VERSION,
    searchableMunicipalities: stats.searchableMunicipalities,
    detailedCities: stats.coverageCities,
    indexedDatasets: getSyncEnabledDatasetIds().length,
    registeredSources: getRegisteredDatasetIds().length,
    registered: getRegisteredDatasetIds().map((id) => ({
      id,
      label: DATASETS[id].label,
      status: DATASETS[id].coverageStatus ?? "authoritative",
      syncEnabled: DATASETS[id].syncEnabled !== false,
      note: DATASETS[id].coverageNote ?? null,
      sourceUrl: DATASETS[id].sourceUrl,
    })),
    cities: stats.cityBreakdown,
    updatedAt: stats.updatedAt,
  };
}
