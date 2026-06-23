import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { computePipelineScore } from "@/lib/pipeline-score";
import { computeTenderScore } from "@/lib/tender-score";
import { assessPermitQuality } from "@/lib/permits/quality";
import {
  buildPermitOpportunityDossier,
  buildTenderOpportunityDossier,
} from "@/lib/opportunities/dossier";
import { parseJsonArray } from "@/lib/usage";

export type CompanyFitProfile = {
  id?: string;
  companyName?: string | null;
  segment: string;
  trades: string[];
  productsOrServices: string[];
  rbqLicenseNumber?: string | null;
  rbqLicenseClasses: string[];
  rbqVerified?: boolean;
  regions: string[];
  municipalities: string[];
  minJobValue?: number | null;
  maxJobValue?: number | null;
  publicPrivatePreference: "public" | "private" | "both";
  preferredBuyerTypes: string[];
  preferredBuyers: string[];
  excludedBuyers: string[];
  excludedWork: string[];
  capacityNotes?: string | null;
  ampAuthorized?: boolean;
  languagePreference: "fr" | "en";
  notificationEmail?: string | null;
};

export type BriefSection =
  | "chase_now"
  | "watch"
  | "ignore"
  | "new_permits"
  | "closing_soon"
  | "compliance_notes"
  | "municipal_signals";

export type QualifiedBriefOpportunity = {
  id: string;
  recordKind: "permit" | "tender" | "roadwork";
  recordId: string;
  title: string;
  sourceType: "permit" | "tender" | "roadwork";
  sourceUrl: string;
  sourceAuthority: string;
  sourceFreshness: string;
  coverageStatus: "indexed" | "registered" | "document_only" | "placeholder" | "stale" | "unavailable";
  location: string;
  buyerOwnerProject: string;
  deadlineOrStage: string;
  value?: number | null;
  fitScore: number;
  riskScore: number;
  confidenceScore: number;
  tradeFit: number;
  territoryFit: number;
  jobSizeFit: number;
  timingFit: number;
  sourceTrustFit: number;
  complianceFit: number;
  siteFit: number;
  reasonToChase: string;
  reasonToWatch: string;
  reasonToIgnore: string;
  recommendedAction: string;
  complianceNotes: string[];
  licenseNotes: string[];
  validationWarnings: string[];
  sections: BriefSection[];
  feedbackAction?: string | null;
};

export type QuebecOpportunityBrief = {
  id: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  briefTitle: string;
  summary: string;
  profile: CompanyFitProfile;
  sections: Record<BriefSection, QualifiedBriefOpportunity[]>;
  sourceCoverageSummary: {
    indexedSources: number;
    registeredSources: number;
    warningCount: number;
    hiddenClaimWarning: string;
  };
  validationWarnings: string[];
};

type SessionUserLike = {
  id?: string;
  email?: string;
  companyName?: string | null;
  rbqLicenseClass?: string | null;
  rbqLicenseNumber?: string | null;
  rbqVerified?: boolean;
  trades?: string | null;
  regions?: string | null;
  ampAuthorized?: boolean;
  minProjectCost?: number | null;
  maxProjectCost?: number | null;
};

const SECTION_ORDER: BriefSection[] = [
  "chase_now",
  "watch",
  "ignore",
  "new_permits",
  "closing_soon",
  "compliance_notes",
  "municipal_signals",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function includesAny(haystack: string, needles: string[]) {
  const normalized = haystack.toLocaleLowerCase("fr-CA");
  return needles
    .map((value) => value.toLocaleLowerCase("fr-CA").trim())
    .filter(Boolean)
    .some((needle) => normalized.includes(needle));
}

function splitProfileText(value?: string | null): string[] {
  return parseJsonArray(value).flatMap((item) =>
    item
      .split(/[;,]/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function profileFromUser(
  user: SessionUserLike | null,
  locale: "fr" | "en" = "fr",
): CompanyFitProfile {
  const trades = splitProfileText(user?.trades);
  const regions = splitProfileText(user?.regions);
  const rbqClasses = user?.rbqLicenseClass
    ? user.rbqLicenseClass.split(/[;,]/).map((value) => value.trim()).filter(Boolean)
    : [];

  return {
    id: user?.id,
    companyName: user?.companyName ?? null,
    segment: "specialty_contractor_or_supplier",
    trades,
    productsOrServices: trades,
    rbqLicenseNumber: user?.rbqLicenseNumber ?? null,
    rbqLicenseClasses: rbqClasses,
    rbqVerified: user?.rbqVerified ?? false,
    regions,
    municipalities: regions,
    minJobValue: user?.minProjectCost ?? null,
    maxJobValue: user?.maxProjectCost ?? null,
    publicPrivatePreference: "both",
    preferredBuyerTypes: ["municipal", "public", "commercial"],
    preferredBuyers: [],
    excludedBuyers: [],
    excludedWork: [],
    ampAuthorized: user?.ampAuthorized ?? false,
    languagePreference: locale,
    notificationEmail: user?.email ?? null,
  };
}

function scoreTrade(profile: CompanyFitProfile, text: string) {
  if (profile.trades.length === 0 && profile.productsOrServices.length === 0) return 55;
  return includesAny(text, [...profile.trades, ...profile.productsOrServices]) ? 92 : 38;
}

function scoreTerritory(profile: CompanyFitProfile, text: string) {
  if (profile.regions.length === 0 && profile.municipalities.length === 0) return 60;
  return includesAny(text, [...profile.regions, ...profile.municipalities]) ? 95 : 35;
}

function scoreJobSize(profile: CompanyFitProfile, value?: number | null) {
  if (!value) return 48;
  if (profile.minJobValue && value < profile.minJobValue) return 35;
  if (profile.maxJobValue && value > profile.maxJobValue) return 40;
  return 90;
}

function sourceFreshness(date?: Date | string | null) {
  if (!date) return { label: "unknown", score: 35 as const };
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return { label: "unknown", score: 35 as const };
  const days = differenceInCalendarDays(new Date(), parsed);
  if (days <= 7) return { label: "this week", score: 95 as const };
  if (days <= 30) return { label: "recent", score: 80 as const };
  if (days <= 90) return { label: "older", score: 55 as const };
  return { label: "stale", score: 25 as const };
}

function coverageFromFreshness(freshness: string): QualifiedBriefOpportunity["coverageStatus"] {
  if (freshness === "stale" || freshness === "unknown") return "stale";
  return "indexed";
}

function sectionsFor(input: {
  recommendation: string;
  kind: "permit" | "tender" | "roadwork";
  deadline?: Date | null;
  hasCompliance: boolean;
}) {
  const sections = new Set<BriefSection>();
  if (input.recommendation === "act_now") sections.add("chase_now");
  else if (input.recommendation === "watch" || input.recommendation === "verify_first") sections.add("watch");
  else sections.add("ignore");

  if (input.kind === "permit") sections.add("new_permits");
  if (input.kind === "roadwork") sections.add("municipal_signals");
  if (input.hasCompliance) sections.add("compliance_notes");
  if (input.deadline) {
    const days = differenceInCalendarDays(input.deadline, new Date());
    if (days >= 0 && days <= 10) sections.add("closing_soon");
  }
  return [...sections];
}

function orderedSections(items: QualifiedBriefOpportunity[]) {
  return Object.fromEntries(
    SECTION_ORDER.map((section) => [
      section,
      items
        .filter((item) => item.sections.includes(section))
        .sort((a, b) => b.fitScore + b.confidenceScore - (a.fitScore + a.confidenceScore))
        .slice(0, section === "ignore" ? 8 : 12),
    ]),
  ) as Record<BriefSection, QualifiedBriefOpportunity[]>;
}

async function permitOpportunities(profile: CompanyFitProfile, limit: number, locale: "fr" | "en") {
  const permits = await prisma.permit.findMany({
    where: { issueDate: { gte: subDays(new Date(), 120) } },
    orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
    take: Math.min(limit * 3, 90),
  });

  return Promise.all(
    permits.map(async (permit): Promise<QualifiedBriefOpportunity> => {
      const quality = assessPermitQuality(permit);
      const pipeline = await computePipelineScore(
        permit,
        {
          rbqLicenseClass: profile.rbqLicenseClasses.join(","),
          rbqLicenseNumber: profile.rbqLicenseNumber,
          rbqVerified: profile.rbqVerified,
          minProjectCost: profile.minJobValue,
          maxProjectCost: profile.maxJobValue,
        },
        undefined,
        { dataQualityScore: quality.score },
      );
      const dossier = buildPermitOpportunityDossier({
        permit,
        score: pipeline.score,
        signals: [],
        pipeline,
        dataQuality: quality,
        locale,
      });
      const text = `${permit.permitType} ${permit.workType ?? ""} ${permit.address} ${permit.borough ?? ""} ${permit.city ?? ""}`;
      const tradeFit = scoreTrade(profile, text);
      const territoryFit = scoreTerritory(profile, text);
      const jobSizeFit = scoreJobSize(profile, permit.estimatedCost);
      const fresh = sourceFreshness(permit.issueDate ?? permit.sourceFetchedAt);
      const complianceFit = permit.requiredRbqClasses || profile.rbqLicenseClasses.length ? 78 : 55;
      const fitScore = clamp(
        tradeFit * 0.22 +
          territoryFit * 0.2 +
          jobSizeFit * 0.14 +
          fresh.score * 0.15 +
          pipeline.confidence * 0.18 +
          complianceFit * 0.11,
      );
      const riskScore = clamp(
        100 -
          (quality.score * 0.35 +
            pipeline.confidence * 0.25 +
            fresh.score * 0.2 +
            complianceFit * 0.2),
      );
      const recommendation = fitScore >= 76 && pipeline.confidence >= 55
        ? "act_now"
        : fitScore >= 52
          ? "watch"
          : "deprioritize";
      const complianceNotes = [
        permit.requiredRbqClasses ? `RBQ classes to verify: ${permit.requiredRbqClasses}` : "",
        profile.rbqLicenseNumber ? `Profile RBQ: ${profile.rbqLicenseNumber}` : "Add RBQ profile to qualify license fit.",
      ].filter(Boolean);

      return {
        id: `permit:${permit.id}`,
        recordKind: "permit",
        recordId: permit.id,
        title: `${permit.permitType} - ${permit.address}`,
        sourceType: "permit",
        sourceUrl: permit.sourceUrl,
        sourceAuthority: permit.city ? `${permit.city} municipal permit source` : "Municipal permit source",
        sourceFreshness: fresh.label,
        coverageStatus: coverageFromFreshness(fresh.label),
        location: [permit.address, permit.borough, permit.city].filter(Boolean).join(" - "),
        buyerOwnerProject: permit.applicantName ?? "Applicant/contact not published",
        deadlineOrStage: permit.issueDate ? `Issued ${permit.issueDate.toISOString().slice(0, 10)}` : "Permit record",
        value: permit.estimatedCost,
        fitScore,
        riskScore,
        confidenceScore: clamp(pipeline.confidence),
        tradeFit,
        territoryFit,
        jobSizeFit,
        timingFit: fresh.score,
        sourceTrustFit: quality.officialSource ? 90 : 45,
        complianceFit,
        siteFit: permit.latitude && permit.longitude ? 72 : 45,
        reasonToChase: dossier.whyRanked[0] ?? "Permit signal matches enough of the company profile to review this week.",
        reasonToWatch: dossier.triage.reason,
        reasonToIgnore: riskScore > 65 ? "Evidence is weak, stale, outside profile, or missing source detail." : "Ignore only if capacity or trade fit is wrong.",
        recommendedAction: dossier.nextAction,
        complianceNotes,
        licenseNotes: dossier.limitations.slice(0, 3),
        validationWarnings: dossier.evidenceThresholds.missingEvidence.slice(0, 4),
        sections: sectionsFor({ recommendation, kind: "permit", hasCompliance: complianceNotes.length > 0 }),
      };
    }),
  );
}

async function tenderOpportunities(profile: CompanyFitProfile, limit: number, locale: "fr" | "en") {
  const tenders = await prisma.tender.findMany({
    where: {
      closesAt: { gte: new Date() },
      OR: [{ status: null }, { status: { not: "closed" } }],
    },
    orderBy: [{ closesAt: "asc" }, { publishedAt: "desc" }],
    take: Math.min(limit * 2, 60),
  });

  return tenders.map((tender): QualifiedBriefOpportunity => {
    const ranking = computeTenderScore(tender, {
      trades: profile.trades,
      regions: profile.regions,
      ampAuthorized: profile.ampAuthorized ?? false,
      minProjectCost: profile.minJobValue,
      maxProjectCost: profile.maxJobValue,
    });
    const dossier = buildTenderOpportunityDossier({
      tender,
      score: ranking.score,
      signals: [],
      ranking,
      locale,
    });
    const text = `${tender.title} ${tender.category ?? ""} ${tender.region ?? ""} ${tender.organization ?? ""}`;
    const tradeFit = scoreTrade(profile, text);
    const territoryFit = scoreTerritory(profile, text);
    const jobSizeFit = scoreJobSize(profile, tender.estimatedValue);
    const fresh = sourceFreshness(tender.publishedAt ?? tender.createdAt);
    const daysLeft = tender.closesAt ? differenceInCalendarDays(tender.closesAt, new Date()) : null;
    const timingFit = daysLeft == null ? 45 : daysLeft < 2 ? 35 : daysLeft <= 14 ? 92 : 75;
    const complianceFit = tender.requiresAmp && !profile.ampAuthorized ? 30 : tender.requiresAmp ? 78 : 70;
    const fitScore = clamp(
      tradeFit * 0.24 +
        territoryFit * 0.18 +
        jobSizeFit * 0.13 +
        timingFit * 0.18 +
        ranking.confidence * 0.16 +
        complianceFit * 0.11,
    );
    const riskScore = clamp(100 - (ranking.confidence * 0.34 + timingFit * 0.26 + complianceFit * 0.2 + fresh.score * 0.2));
    const recommendation = fitScore >= 74 && riskScore <= 58
      ? "act_now"
      : fitScore >= 50
        ? "verify_first"
        : "deprioritize";
    const complianceNotes = [
      tender.requiresAmp ? "AMP authorization may be required before bidding." : "",
      "Official SEAO documents and addenda must be reviewed before bid/no-bid.",
    ].filter(Boolean);

    return {
      id: `tender:${tender.id}`,
      recordKind: "tender",
      recordId: tender.id,
      title: tender.title,
      sourceType: "tender",
      sourceUrl: tender.sourceUrl,
      sourceAuthority: "SEAO public tender notice",
      sourceFreshness: fresh.label,
      coverageStatus: coverageFromFreshness(fresh.label),
      location: tender.region ?? "Quebec",
      buyerOwnerProject: tender.organization ?? "Buyer not normalized",
      deadlineOrStage: tender.closesAt ? `Closes ${tender.closesAt.toISOString().slice(0, 10)}` : "Tender watch",
      value: tender.estimatedValue,
      fitScore,
      riskScore,
      confidenceScore: clamp(ranking.confidence),
      tradeFit,
      territoryFit,
      jobSizeFit,
      timingFit,
      sourceTrustFit: 92,
      complianceFit,
      siteFit: 50,
      reasonToChase: dossier.whyRanked[0] ?? "SEAO opportunity matches enough of the company profile to review.",
      reasonToWatch: dossier.triage.reason,
      reasonToIgnore: riskScore > 65 ? "Deadline, compliance, value, or fit risk is too high for immediate estimating time." : "Ignore only if documents confirm poor scope fit.",
      recommendedAction: dossier.nextAction,
      complianceNotes,
      licenseNotes: dossier.limitations.slice(0, 3),
      validationWarnings: dossier.evidenceThresholds.missingEvidence.slice(0, 4),
      sections: sectionsFor({ recommendation, kind: "tender", deadline: tender.closesAt, hasCompliance: complianceNotes.length > 0 }),
    };
  });
}

async function municipalSignalOpportunities(profile: CompanyFitProfile, limit: number) {
  const roadworks = await prisma.roadWork.findMany({
    where: { OR: [{ startDate: { gte: subDays(new Date(), 30) } }, { startDate: null }] },
    orderBy: [{ startDate: "asc" }, { sourceFetchedAt: "desc" }],
    take: Math.min(limit, 24),
  });

  return roadworks.map((roadwork): QualifiedBriefOpportunity => {
    const text = `${roadwork.title ?? ""} ${roadwork.description ?? ""} ${roadwork.borough ?? ""} ${roadwork.city}`;
    const tradeFit = scoreTrade(profile, `${text} excavation paving asphalt concrete civil signalisation water sewer`);
    const territoryFit = scoreTerritory(profile, text);
    const fresh = sourceFreshness(roadwork.startDate ?? roadwork.sourceFetchedAt);
    const fitScore = clamp(tradeFit * 0.28 + territoryFit * 0.28 + fresh.score * 0.24 + 55 * 0.2);
    const riskScore = clamp(100 - (fresh.score * 0.45 + territoryFit * 0.25 + tradeFit * 0.2 + 50 * 0.1));
    const recommendation = fitScore >= 70 ? "watch" : "deprioritize";

    return {
      id: `roadwork:${roadwork.id}`,
      recordKind: "roadwork",
      recordId: roadwork.id,
      title: roadwork.title ?? roadwork.description ?? "Municipal roadwork signal",
      sourceType: "roadwork",
      sourceUrl: roadwork.sourceUrl,
      sourceAuthority: `${roadwork.city} roadwork / infrastructure source`,
      sourceFreshness: fresh.label,
      coverageStatus: coverageFromFreshness(fresh.label),
      location: [roadwork.borough, roadwork.city].filter(Boolean).join(" - "),
      buyerOwnerProject: roadwork.status ?? "Municipal infrastructure signal",
      deadlineOrStage: roadwork.startDate ? `Starts ${roadwork.startDate.toISOString().slice(0, 10)}` : "Municipal signal",
      fitScore,
      riskScore,
      confidenceScore: fresh.score,
      tradeFit,
      territoryFit,
      jobSizeFit: 50,
      timingFit: fresh.score,
      sourceTrustFit: 78,
      complianceFit: 50,
      siteFit: roadwork.latitude && roadwork.longitude ? 70 : 45,
      reasonToChase: "Municipal infrastructure signal may create supplier or subcontractor preparation work.",
      reasonToWatch: "Watch until a tender, permit, capital-plan update, or buyer action appears.",
      reasonToIgnore: "Ignore if territory or civil/infrastructure scope does not match your company.",
      recommendedAction: "Add to watchlist, confirm the municipal source, and look for related SEAO or city procurement notices.",
      complianceNotes: ["This is not a bid notice; official procurement must be confirmed at source."],
      licenseNotes: ["Municipal signal only. Validate RBQ/compliance requirements if it becomes a tender."],
      validationWarnings: ["Pre-RFP municipal signals are valuable only if filtered and actionable."],
      sections: sectionsFor({ recommendation, kind: "roadwork", deadline: roadwork.startDate, hasCompliance: false }),
    };
  });
}

export async function buildQuebecOpportunityBrief(input: {
  user?: SessionUserLike | null;
  locale?: "fr" | "en";
  limit?: number;
}): Promise<QuebecOpportunityBrief> {
  const locale = input.locale ?? "fr";
  const limit = input.limit ?? 25;
  const profile = profileFromUser(input.user ?? null, locale);
  const [permits, tenders, municipalSignals] = await Promise.all([
    permitOpportunities(profile, limit, locale),
    tenderOpportunities(profile, limit, locale),
    municipalSignalOpportunities(profile, Math.ceil(limit / 2)),
  ]);
  const all = [...permits, ...tenders, ...municipalSignals]
    .sort((a, b) => b.fitScore + b.confidenceScore - (a.fitScore + a.confidenceScore))
    .slice(0, Math.max(limit, 30));
  const sections = orderedSections(all);
  const warnings = [
    profile.trades.length === 0 ? "Add trades/products to improve trade-fit scoring." : "",
    profile.regions.length === 0 ? "Add regions/municipalities to improve territory scoring." : "",
    "ZONNING is not replacing SEAO/MERX bid submission or official documents.",
    "Coverage is source-backed but not complete Quebec coverage.",
  ].filter(Boolean);
  const chaseCount = sections.chase_now.length;
  const watchCount = sections.watch.length + sections.municipal_signals.length;

  return {
    id: `brief:${input.user?.id ?? "guest"}:${new Date().toISOString().slice(0, 10)}`,
    periodStart: subDays(new Date(), 7).toISOString(),
    periodEnd: addDays(new Date(), 7).toISOString(),
    generatedAt: new Date().toISOString(),
    briefTitle: "This week for your company",
    summary: `${chaseCount} chase-now items and ${watchCount} watch/early signals were qualified from permits, SEAO notices, and municipal infrastructure sources.`,
    profile,
    sections,
    sourceCoverageSummary: {
      indexedSources: all.filter((item) => item.coverageStatus === "indexed").length,
      registeredSources: all.length,
      warningCount: warnings.length + all.reduce((sum, item) => sum + item.validationWarnings.length, 0),
      hiddenClaimWarning: "Do not claim complete Quebec coverage. Use source, freshness, and confidence labels.",
    },
    validationWarnings: warnings,
  };
}
