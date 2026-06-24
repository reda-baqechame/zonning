import type { OpportunityDossier } from "@/lib/domain/quebec";
import type { ContractorCompliance } from "@/lib/compliance/contractor-compliance";
import type { ReadinessProfile } from "@/lib/readiness-passport";
import {
  computeBidRecommendation,
  computeWinProbability,
} from "@/lib/tenders/win-probability";
import type { TenderScoreResult } from "@/lib/tender-score";

type GovernmentMission = NonNullable<OpportunityDossier["governmentMission"]>;
type Locale = "fr" | "en";

export type PersonalBlocker = {
  id: string;
  label: string;
  severity: "blocker" | "warning";
  href?: string;
};

export type TenderAwardStats = {
  distinctWinners: number;
  incumbentDominance: number;
  topIncumbentName?: string | null;
  isUserIncumbent?: boolean;
};

export type OpportunityDecision = {
  worthPursuing: GovernmentMission["verdict"];
  headline: string;
  personalBlockers: PersonalBlocker[];
  winProbability: number;
  expectedValue: number | null;
  winConfidence: "low" | "medium" | "high";
  deadlineLabel: string;
  deadlineRisk: GovernmentMission["deadlineRisk"];
  buyDocuments: boolean;
  buyDocumentsReason: string;
  primaryButton: { label: string; href: string };
  blockerCount: number;
  trackRecommended: boolean;
};

type TenderContext = {
  requiresAmp?: boolean;
  sourceUrl: string;
  estimatedValue?: number | null;
};

function copy(locale: Locale, fr: string, en: string) {
  return locale === "fr" ? fr : en;
}

function statusValid(value?: string | null): boolean {
  return value === "valid" || value === "compliant";
}

function notExpired(value?: Date | string | null): boolean {
  if (!value) return false;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isFinite(d.getTime()) && d.getTime() >= Date.now();
}

export function buildPersonalBlockers(input: {
  profile: ReadinessProfile;
  tender: TenderContext;
  compliance?: ContractorCompliance | null;
  locale: Locale;
}): PersonalBlocker[] {
  const { profile, tender, compliance, locale } = input;
  const blockers: PersonalBlocker[] = [];

  if (compliance?.renaNonAdmissible?.active) {
    blockers.push({
      id: "rena",
      label: copy(
        locale,
        "RENA : entreprise non admissible aux contrats publics fédéraux (vérifié dans l'index).",
        "RENA: enterprise not eligible for federal public contracts (verified in index).",
      ),
      severity: "blocker",
      href: "https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpInq.html",
    });
  }

  if (tender.requiresAmp && !profile.ampAuthorized) {
    blockers.push({
      id: "amp",
      label: copy(
        locale,
        "AMP requise — autorisation non déclarée dans votre profil.",
        "AMP required — authorization not declared in your profile.",
      ),
      severity: "blocker",
      href: "https://www.amp.quebec/en/autorisation-de-contracter",
    });
  }

  const revenuReady =
    statusValid(profile.revenuQuebecStatus) &&
    (profile.revenuQuebecStatus !== "valid" || notExpired(profile.revenuQuebecExpiresAt));
  if (!revenuReady) {
    blockers.push({
      id: "revenu-quebec",
      label: copy(
        locale,
        "Attestation Revenu Québec manquante ou expirée — bloqueur de soumission.",
        "Revenu Québec attestation missing or expired — submission blocker.",
      ),
      severity: "blocker",
      href: "/settings",
    });
  }

  if (!profile.rbqLicenseNumber) {
    blockers.push({
      id: "rbq-number",
      label: copy(
        locale,
        "Numéro RBQ absent — impossible de qualifier la licence pour cet appel.",
        "RBQ number missing — cannot qualify licence for this tender.",
      ),
      severity: "warning",
      href: "/settings",
    });
  } else if (!profile.rbqLicenseClass) {
    blockers.push({
      id: "rbq-class",
      label: copy(
        locale,
        "Classe RBQ non configurée — vérifiez la sous-catégorie exigée.",
        "RBQ class not configured — verify required subclass.",
      ),
      severity: "warning",
      href: "/settings",
    });
  }

  if (!profile.lobbyismDeclarationOnFile) {
    blockers.push({
      id: "lobbyism",
      label: copy(
        locale,
        "Déclaration lobbyisme / non-collusion non en dossier.",
        "Lobbying / non-collusion declaration not on file.",
      ),
      severity: "warning",
      href: "https://www.quebec.ca/gouvernement/politiques/lobbyisme",
    });
  }

  return blockers;
}

function mergeVerdict(
  missionVerdict: GovernmentMission["verdict"],
  personalBlockers: PersonalBlocker[],
  deadlineRisk: GovernmentMission["deadlineRisk"],
): GovernmentMission["verdict"] {
  const hardBlockers = personalBlockers.filter((b) => b.severity === "blocker");
  if (hardBlockers.some((b) => b.id === "rena")) return "skip";
  if (deadlineRisk === "missed") return "skip";
  if (hardBlockers.length > 0) {
    if (deadlineRisk === "urgent") return "skip";
    return "verify_before_spend";
  }
  if (missionVerdict === "pursue" && personalBlockers.length > 0) {
    return "verify_before_spend";
  }
  return missionVerdict;
}

function buildHeadline(
  verdict: GovernmentMission["verdict"],
  personalBlockers: PersonalBlocker[],
  winProbability: number,
  locale: Locale,
): string {
  const hard = personalBlockers.filter((b) => b.severity === "blocker");
  if (hard.length > 0) {
    const labels = hard.slice(0, 2).map((b) => b.label.split("—")[0].trim());
    return copy(
      locale,
      `Bloqué pour vous : ${labels.join(" · ")}`,
      `Blocked for you: ${labels.join(" · ")}`,
    );
  }
  if (verdict === "pursue") {
    return copy(
      locale,
      `Bon candidat — probabilité de gain estimée à ${winProbability} %.`,
      `Strong candidate — estimated win probability ${winProbability}%.`,
    );
  }
  if (verdict === "verify_before_spend") {
    return copy(
      locale,
      "Vérifiez votre préparation avant d'acheter les documents ou d'estimer.",
      "Verify your readiness before buying documents or estimating.",
    );
  }
  if (verdict === "skip") {
    return copy(
      locale,
      "Ne pas poursuivre — bloqueur ou échéance critique.",
      "Do not pursue — blocker or critical deadline.",
    );
  }
  return copy(locale, "Surveillez sans engager de capacité aujourd'hui.", "Watch without committing capacity today.");
}

export function buildOpportunityDecision(input: {
  mission: GovernmentMission;
  profile: ReadinessProfile;
  compliance?: ContractorCompliance | null;
  tender: TenderContext;
  ranking: Pick<TenderScoreResult, "score">;
  awardStats?: TenderAwardStats;
  locale: Locale;
}): OpportunityDecision {
  const { mission, profile, compliance, tender, ranking, awardStats, locale } = input;
  const personalBlockers = buildPersonalBlockers({ profile, tender, compliance, locale });
  const hardBlockerCount = personalBlockers.filter((b) => b.severity === "blocker").length;

  const win = computeWinProbability({
    matchScore: ranking.score,
    ampRequired: Boolean(tender.requiresAmp),
    ampAuthorized: Boolean(profile.ampAuthorized),
    rbqEligible: profile.rbqLicenseClass ? true : profile.rbqLicenseNumber ? undefined : false,
    estimatedValue: tender.estimatedValue,
    userMinCost: profile.minProjectCost,
    userMaxCost: profile.maxProjectCost,
    distinctWinners: awardStats?.distinctWinners ?? 5,
    incumbentDominance: awardStats?.incumbentDominance ?? 0.3,
    isUserIncumbent: awardStats?.isUserIncumbent,
  });

  const bid = computeBidRecommendation(win, {
    matchScore: ranking.score,
    ampRequired: Boolean(tender.requiresAmp),
    ampAuthorized: Boolean(profile.ampAuthorized),
    rbqEligible: profile.rbqLicenseClass ? true : undefined,
  });

  const worthPursuing = mergeVerdict(mission.verdict, personalBlockers, mission.deadlineRisk);
  const buyDocuments =
    mission.worthBuyingDocuments &&
    hardBlockerCount === 0 &&
    worthPursuing !== "skip" &&
    bid.decision !== "no-bid";

  const buyDocumentsReason = buyDocuments
    ? copy(
        locale,
        "Votre profil ne présente pas de bloqueur connu — les documents valent l'achat sur le site officiel.",
        "Your profile shows no known blockers — documents are worth ordering on the official site.",
      )
    : hardBlockerCount > 0
      ? copy(
          locale,
          `Ne pas acheter les documents — ${hardBlockerCount} bloqueur(s) à lever d'abord.`,
          `Don't buy documents — clear ${hardBlockerCount} blocker(s) first.`,
        )
      : copy(
          locale,
          mission.worthBuyingDocuments
            ? "Surveillez ce marché mais n'achetez pas encore les documents."
            : "Ne pas acheter les documents pour l'instant.",
          mission.worthBuyingDocuments
            ? "Watch this tender but don't buy documents yet."
            : "Don't buy documents yet.",
        );

  const officialButton = mission.nextButtons.find((b) => b.kind === "official_source");
  const primaryTask = mission.taskBoard.find((t) => t.href);
  const primaryButton = {
    label:
      officialButton?.label ??
      primaryTask?.buttonLabel ??
      copy(locale, "Ouvrir la source", "Open source"),
    href: officialButton?.href ?? primaryTask?.href ?? tender.sourceUrl,
  };

  const trackRecommended =
    worthPursuing !== "skip" &&
    (mission.deadlineRisk === "urgent" ||
      mission.deadlineRisk === "soon" ||
      hardBlockerCount > 0);

  return {
    worthPursuing,
    headline: buildHeadline(worthPursuing, personalBlockers, win.winProbability, locale),
    personalBlockers,
    winProbability: win.winProbability,
    expectedValue: win.expectedValue,
    winConfidence: win.confidence,
    deadlineLabel: mission.deadlineLabel,
    deadlineRisk: mission.deadlineRisk,
    buyDocuments,
    buyDocumentsReason,
    primaryButton,
    blockerCount: hardBlockerCount,
    trackRecommended,
  };
}
