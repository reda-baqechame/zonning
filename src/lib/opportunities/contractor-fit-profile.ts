import type { ValueEstimate } from "@/lib/permits/value-estimate";
import { rbqClassMatches } from "@/lib/opportunities/contact-resolver";

/**
 * Profile-aware opportunity fit-score. Replaces the generic keyword scoring in
 * contractor-fit.ts when a user is signed in: scores against the contractor's
 * RBQ class, regions, trades, and project budget range. Returns an anonymous
 * magnet score for public (logged-out) surfaces — never personalized data.
 */

export type ContractorProfile = {
  rbqLicenseClass?: string | null;
  trades?: string[] | null;
  regions?: string[] | null;
  minProjectCost?: number | null;
  maxProjectCost?: number | null;
};

export type FitBreakdown = { id: string; label: string; points: number };

export type FitScore = {
  score: number; // 0-100
  level: "strong" | "related" | "support" | "weak";
  breakdown: FitBreakdown[];
};

type OpportunityInput = {
  kind: "permit" | "tender";
  requiredRbqClasses?: string[];
  city?: string | null;
  region?: string | null;
  permitType?: string | null;
  title?: string | null;
  valueEstimate?: ValueEstimate;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreOpportunityForUser(
  item: OpportunityInput,
  profile: ContractorProfile | null,
): FitScore {
  // Public (anonymous) surface: a coarse magnet score, no personalization.
  if (!profile) {
    const typeBonus =
      /construction|rénovation|renovation|transformation|agrandiss/i.test(
        `${item.permitType ?? ""} ${item.title ?? ""}`,
      )
        ? 55
        : 25;
    return {
      score: clamp(typeBonus),
      level: typeBonus >= 50 ? "related" : "weak",
      breakdown: [
        { id: "anonymous", label: "Score public non personnalisé", points: typeBonus },
      ],
    };
  }

  const breakdown: FitBreakdown[] = [];

  // RBQ class match — the heaviest single signal, and an eligibility GATE: a
  // contractor without the required class cannot legally do the work. A
  // mismatch is therefore a near-disqualifier, not a soft preference.
  const required = item.requiredRbqClasses ?? [];
  const profileClass = profile.rbqLicenseClass ?? "";
  const classMatches =
    required.length > 0 && profileClass
      ? rbqClassMatches(profileClass, required)
      : false;
  if (classMatches) {
    breakdown.push({ id: "rbq_class_match", label: "Classe RBQ correspondante", points: 40 });
  } else if (required.length > 0) {
    breakdown.push({ id: "rbq_class_mismatch", label: "Classe RBQ non correspondante (non admissible)", points: -55 });
  }

  // Region match.
  const itemRegion = (item.city ?? item.region ?? "").toLowerCase();
  const regions = (profile.regions ?? []).map((r) => r.toLowerCase());
  const regionMatch =
    itemRegion.length > 0 &&
    regions.some((r) => itemRegion.includes(r) || r.includes(itemRegion));
  if (regionMatch) {
    breakdown.push({ id: "region_match", label: "Région desservie", points: 20 });
  } else if (itemRegion) {
    breakdown.push({ id: "region_mismatch", label: "Hors région desservie", points: -10 });
  }

  // Value band vs configured budget.
  const v = item.valueEstimate;
  const minB = profile.minProjectCost ?? 0;
  const maxB = profile.maxProjectCost ?? Infinity;
  if (v?.kind === "estimated" || v?.kind === "published") {
    const low = v.kind === "estimated" ? v.low : v.value;
    const high = v.kind === "estimated" ? v.high : v.value;
    const overlaps = high >= minB && low <= maxB;
    if (overlaps) {
      breakdown.push({ id: "value_in_budget", label: "Valeur dans la plage de projets", points: 25 });
    } else {
      breakdown.push({ id: "value_outside_budget", label: "Valeur hors plage de projets", points: -15 });
    }
  } else {
    breakdown.push({ id: "value_unknown", label: "Valeur non estimée", points: 0 });
  }

  // Trade keyword intersection (accent-insensitive).
  const text = `${item.permitType ?? ""} ${item.title ?? ""}`.toLowerCase();
  const stripped = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const trades = (profile.trades ?? []).map((t) => t.toLowerCase());
  const tradeHits = trades.filter((t) => {
    if (!t) return false;
    const tStripped = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return text.includes(t) || stripped.includes(tStripped);
  });
  if (tradeHits.length) {
    breakdown.push({ id: "trade_match", label: "Métier correspondant", points: 15 });
  }

  const raw = breakdown.reduce((sum, b) => sum + b.points, 50); // base 50
  const score = clamp(raw);
  // An RBQ mismatch means the contractor cannot legally perform the work, so
  // it caps the level at "weak" regardless of region/budget overlap.
  const rbqMismatch = breakdown.some((b) => b.id === "rbq_class_mismatch");
  const level: FitScore["level"] = rbqMismatch
    ? "weak"
    : score >= 75
      ? "strong"
      : score >= 55
        ? "related"
        : score >= 35
          ? "support"
          : "weak";
  return { score, level, breakdown };
}
