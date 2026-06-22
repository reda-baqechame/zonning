/**
 * Tender win-probability, expected value, "why this fits you" reasons and a
 * bid/no-bid recommendation.
 *
 * Public-procurement odds are driven less by how much you *like* a tender than
 * by structural factors: whether you clear the gating requirements (RBQ class,
 * AMP authorization), how concentrated the historical award history is (an
 * entrenched incumbent is hard to unseat), how many distinct firms actually win
 * this category, and whether the contract size sits in your sweet spot. This
 * model fuses ZONNING's SEAO awards history with the user's profile — signal no
 * single competitor combines for Quebec.
 *
 * Pure and deterministic so it is unit-testable without a database.
 */

export type WinProbabilityInput = {
  /** Existing 0–100 profile fit (trade/region/category). */
  matchScore: number;
  /** RBQ eligibility for the work, if known. */
  rbqEligible?: boolean;
  ampRequired: boolean;
  ampAuthorized: boolean;
  estimatedValue?: number | null;
  userMinCost?: number | null;
  userMaxCost?: number | null;
  /** Distinct historical winners in this category/UNSPSC. */
  distinctWinners: number;
  /** Share (0–1) of historical awards held by the single top incumbent. */
  incumbentDominance: number;
  /** True when the user has previously won similar awards. */
  isUserIncumbent?: boolean;
};

export type WinProbabilityResult = {
  winProbability: number; // 0–100
  expectedValue: number | null;
  confidence: "low" | "medium" | "high";
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computeWinProbability(input: WinProbabilityInput): WinProbabilityResult {
  // Baseline odds for an eligible bidder in a competitive public tender.
  let p = 0.15;

  // Profile fit is the largest controllable lever.
  p += (clamp(input.matchScore, 0, 100) / 100) * 0.35;

  // AMP is a hard gate above the threshold — decisive either way.
  if (input.ampRequired) p += input.ampAuthorized ? 0.05 : -0.55;

  // RBQ ineligibility is nearly disqualifying.
  if (input.rbqEligible === false) p -= 0.25;

  // Competition: a category won by only a handful of firms is more winnable.
  const w = input.distinctWinners;
  const compFactor = w <= 2 ? 0.12 : w <= 5 ? 0.05 : w <= 10 ? -0.02 : -0.1;
  p += compFactor;

  // Incumbency cuts both ways.
  if (input.isUserIncumbent) p += 0.18;
  else p -= clamp(input.incumbentDominance, 0, 1) * 0.2;

  // Contract-size fit.
  const { estimatedValue, userMinCost, userMaxCost } = input;
  if (estimatedValue != null) {
    if (userMaxCost && estimatedValue > userMaxCost * 1.5) p -= 0.12;
    if (userMinCost && estimatedValue < userMinCost * 0.5) p -= 0.08;
  }

  const winProbability = Math.round(clamp(p, 0.02, 0.95) * 100);
  const expectedValue =
    estimatedValue != null ? Math.round(estimatedValue * (winProbability / 100)) : null;

  // Confidence reflects how much history backs the estimate.
  let confidence: WinProbabilityResult["confidence"] = "low";
  if (input.distinctWinners >= 3 && estimatedValue != null) confidence = "high";
  else if (input.distinctWinners >= 1 || estimatedValue != null) confidence = "medium";

  return { winProbability, expectedValue, confidence };
}

export type MatchReason = { fr: string; en: string; positive: boolean };

export type MatchReasonInput = {
  matchedTrades: string[];
  matchedRegion?: string | null;
  ampRequired: boolean;
  ampAuthorized: boolean;
  rbqEligible?: boolean;
  valueFit?: "in_range" | "too_large" | "too_small" | "unknown";
  distinctWinners: number;
  isUserIncumbent?: boolean;
  topIncumbentName?: string | null;
};

/** Bilingual, explainable "why this fits you" bullets. */
export function buildMatchReasons(input: MatchReasonInput): MatchReason[] {
  const reasons: MatchReason[] = [];

  if (input.matchedTrades.length > 0) {
    const list = input.matchedTrades.join(", ");
    reasons.push({
      fr: `Correspond à votre métier : ${list}`,
      en: `Matches your trade: ${list}`,
      positive: true,
    });
  }
  if (input.matchedRegion) {
    reasons.push({
      fr: `Dans votre région : ${input.matchedRegion}`,
      en: `In your region: ${input.matchedRegion}`,
      positive: true,
    });
  }
  if (input.ampRequired) {
    reasons.push(
      input.ampAuthorized
        ? { fr: "AMP requise — vous êtes autorisé", en: "AMP required — you are authorized", positive: true }
        : { fr: "AMP requise — autorisation manquante", en: "AMP required — authorization missing", positive: false },
    );
  }
  if (input.rbqEligible === false) {
    reasons.push({
      fr: "Votre sous-classe RBQ ne couvre pas ce mandat",
      en: "Your RBQ subclass doesn't cover this work",
      positive: false,
    });
  }
  if (input.isUserIncumbent) {
    reasons.push({
      fr: "Vous avez déjà remporté des contrats similaires",
      en: "You've won similar contracts before",
      positive: true,
    });
  } else if (input.topIncumbentName) {
    reasons.push({
      fr: `Titulaire en place : ${input.topIncumbentName}`,
      en: `Incumbent to unseat: ${input.topIncumbentName}`,
      positive: false,
    });
  }
  if (input.distinctWinners > 0 && input.distinctWinners <= 3) {
    reasons.push({
      fr: `Faible concurrence — ${input.distinctWinners} titulaire(s) historique(s)`,
      en: `Low competition — ${input.distinctWinners} historical winner(s)`,
      positive: true,
    });
  }
  if (input.valueFit === "too_large") {
    reasons.push({ fr: "Plus gros que vos mandats habituels", en: "Larger than your usual projects", positive: false });
  } else if (input.valueFit === "too_small") {
    reasons.push({ fr: "Plus petit que vos mandats habituels", en: "Smaller than your usual projects", positive: false });
  } else if (input.valueFit === "in_range") {
    reasons.push({ fr: "Taille de contrat dans votre fourchette", en: "Contract size in your range", positive: true });
  }

  return reasons;
}

export type BidRecommendation = {
  decision: "bid" | "consider" | "monitor" | "no-bid";
  labelFr: string;
  labelEn: string;
  rationaleFr: string;
  rationaleEn: string;
};

export function computeBidRecommendation(
  win: WinProbabilityResult,
  ctx: { matchScore: number; ampRequired: boolean; ampAuthorized: boolean; rbqEligible?: boolean },
): BidRecommendation {
  if (ctx.ampRequired && !ctx.ampAuthorized) {
    return {
      decision: "no-bid",
      labelFr: "Ne pas soumissionner",
      labelEn: "No-bid",
      rationaleFr: "Autorisation AMP requise et absente — inadmissible.",
      rationaleEn: "AMP authorization required and missing — ineligible.",
    };
  }
  if (ctx.rbqEligible === false) {
    return {
      decision: "no-bid",
      labelFr: "Ne pas soumissionner",
      labelEn: "No-bid",
      rationaleFr: "Sous-classe RBQ non couvrante pour ce mandat.",
      rationaleEn: "RBQ subclass doesn't cover this work.",
    };
  }
  if (win.winProbability >= 45 && ctx.matchScore >= 60) {
    return {
      decision: "bid",
      labelFr: "Soumissionner",
      labelEn: "Bid",
      rationaleFr: "Bonne probabilité de gain et fort alignement profil.",
      rationaleEn: "Strong win odds and high profile fit.",
    };
  }
  if (win.winProbability >= 25) {
    return {
      decision: "consider",
      labelFr: "À considérer",
      labelEn: "Consider",
      rationaleFr: "Opportunité valable — pesez l'effort de soumission.",
      rationaleEn: "Worthwhile opportunity — weigh the bid effort.",
    };
  }
  return {
    decision: "monitor",
    labelFr: "Surveiller",
    labelEn: "Monitor",
    rationaleFr: "Faible probabilité — surveillez les addendas et la concurrence.",
    rationaleEn: "Low odds — watch for amendments and competition.",
  };
}
