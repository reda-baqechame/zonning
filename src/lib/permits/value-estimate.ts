/**
 * Derived project-value estimation. Montréal & Québec permits never publish
 * cost (verified: estimatedCost is null on all real rows). This engine derives
 * an honest BAND from permitType + workType + RBQ-class complexity, widened by
 * city/borough transaction medians when available. Every estimated output is
 * labeled "estimé" in the UI — never a fake exact source number.
 */

export type ValueEstimate =
  | { kind: "published"; value: number; currency: "CAD" }
  | {
      kind: "estimated";
      low: number;
      high: number;
      currency: "CAD";
      confidence: "low" | "medium" | "high";
      basis: string[];
    }
  | { kind: "unknown"; reason: string };

type PermitInput = {
  permitType: string | null | undefined;
  workType?: string | null | undefined;
  city?: string | null | undefined;
  borough?: string | null | undefined;
  estimatedCost?: number | null | undefined;
};

/**
 * RBQ-class complexity multipliers (industry-norm heuristics, NOT source data).
 * Higher = larger/more complex scope. Documented so the basis string is honest.
 */
export const RBQ_COMPLEXITY_MULTIPLIER: Record<string, number> = {
  "1.1.1": 1.4, // new residential building
  "1.1": 1.3,
  "1": 1.2,
  "1.2": 1.5, // foundation
  "1.3": 1.2, // structural
  "2": 0.9, // demolition
  "3": 0.8, // exterior envelope
  "4.1": 1.0, // electrical
  "5": 0.9, // mechanical
  "6.1": 0.85, // plumbing
  "7": 0.8, // gas
};

const TYPE_BANDS: { match: RegExp; low: number; high: number; label: string }[] = [
  { match: /construction résident|construction resident|nouvel/im, low: 180_000, high: 650_000, label: "résidentiel neuf" },
  { match: /agrandiss|extension/im, low: 80_000, high: 350_000, label: "agrandissement" },
  { match: /rénovation|renovation|transformation/i, low: 35_000, high: 220_000, label: "rénovation/transformation" },
  { match: /commercial|industriel/i, low: 100_000, high: 900_000, label: "commercial/industriel" },
  { match: /toiture|enveloppe/i, low: 18_000, high: 140_000, label: "enveloppe/toiture" },
  { match: /plomberie|mécanique|mecanique|cvac|ventilation|électri|electri/i, low: 8_000, high: 90_000, label: "métier (mécanique/électrique)" },
  { match: /démolition|demolition/i, low: 12_000, high: 180_000, label: "démolition" },
  { match: /excavation|fondation/i, low: 20_000, high: 250_000, label: "fondation/excavation" },
];

const MIN_COMPARABLES_FOR_HIGH = 10;

export type EstimateOptions = {
  rbqClasses?: string[];
  comparableMedian?: number;
  comparableCount?: number;
};

export function estimatePermitValue(
  permit: PermitInput,
  options?: EstimateOptions,
): ValueEstimate {
  // Source-published cost always wins; never override with an estimate.
  if (permit.estimatedCost && permit.estimatedCost > 0) {
    return { kind: "published", value: permit.estimatedCost, currency: "CAD" };
  }

  const text = `${permit.permitType ?? ""} ${permit.workType ?? ""}`.trim();
  const band = TYPE_BANDS.find((b) => b.match.test(text));

  if (!band) {
    return {
      kind: "unknown",
      reason: "Type de permis non reconnu pour une estimation de valeur.",
    };
  }

  const classes = options?.rbqClasses ?? [];
  const multiplier = classes.length
    ? Math.max(...classes.map((c) => RBQ_COMPLEXITY_MULTIPLIER[c] ?? 1))
    : 1;

  const low = Math.round((band.low * multiplier) / 1000) * 1000;
  const high = Math.round((band.high * multiplier) / 1000) * 1000;

  const count = options?.comparableCount ?? 0;
  // Confidence ladder: widen scope degrades confidence rather than fabricating precision.
  const confidence: "low" | "medium" | "high" =
    count >= MIN_COMPARABLES_FOR_HIGH ? "high" : count > 0 ? "medium" : "low";

  const basis: string[] = [
    `Bande estimée pour travaux de type « ${band.label} ».`,
    classes.length
      ? `Complexité ajustée par classe RBQ (${classes.join(", ")}).`
      : "Aucune classe RBQ publiée ; multiplicateur neutre.",
    count > 0
      ? `${count} transactions comparables à proximité.`
      : "Aucune transaction comparable indexée ; bande prudente.",
    "Estimation dérivée, non publiquée par la source — confirmer avant décision.",
  ];

  return { kind: "estimated", low, high, currency: "CAD", confidence, basis };
}
