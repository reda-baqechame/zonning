import type { PropertyIntelligence } from "@/lib/intelligence";
import { computeDensityGap } from "@/lib/pipeline-score";

export type VerdictTier = "insufficient_data" | "eleve" | "moyen" | "faible" | "bloque";

export type VerdictResult = {
  tier: VerdictTier;
  labelFr: string;
  labelEn: string;
  reasonsFr: string[];
  reasonsEn: string[];
  densityGap?: string;
  score?: number;
  confidence: number;
  limitations: string[];
};

function hasMaterialEvidence(intel: PropertyIntelligence): boolean {
  return Boolean(
      intel.assessment ||
      intel.recentTransaction ||
      (intel.contamination &&
        (intel.contamination.nearby ||
          intel.contamination.gtcNearby ||
          (intel.contamination.count ?? 0) > 0 ||
          (intel.contamination.gtcCount ?? 0) > 0)) ||
      intel.zoning ||
      (intel.heritage &&
        (intel.heritage.nearby ||
          intel.heritage.hasEip ||
          intel.heritage.lpcProtected ||
          intel.heritage.pum2050Listed ||
          intel.heritage.count > 0)) ||
      intel.permitDelays ||
      (intel.roadworks && (intel.roadworks.nearby || intel.roadworks.count > 0)) ||
      intel.municipalContracts ||
      intel.marketHeat ||
      intel.developmentProjects ||
      intel.rbqInfraction ||
      intel.municipalInspection
  );
}

export function computeVerdictTier(intel: PropertyIntelligence): VerdictResult {
  const reasonsFr: string[] = [];
  const reasonsEn: string[] = [];
  const limitations: string[] = [];

  if (!hasMaterialEvidence(intel)) {
    return {
      tier: "insufficient_data",
      labelFr: "Donnees insuffisantes",
      labelEn: "Insufficient data",
      reasonsFr: ["Aucune preuve publique suffisante n'a ete trouvee pour produire un verdict."],
      reasonsEn: ["No sufficient public evidence was found to produce a verdict."],
      confidence: 0,
      limitations: [
        "No parcel, zoning, assessment, permit, constraint, or comparable-project evidence was available.",
        "The system must not infer development potential from missing data.",
      ],
    };
  }
  let score = 50;

  if (intel.contamination?.gtcNearby) {
    score -= 12;
    reasonsFr.push("Entrée GTC à proximité — correspondance à la parcelle non établie");
    reasonsEn.push("GTC entry nearby — parcel match not established");
  } else if (intel.contamination?.nearby) {
    score -= 8;
    reasonsFr.push("Signal environnemental à proximité — parcelle à confirmer");
    reasonsEn.push("Environmental signal nearby — parcel confirmation required");
  }

  if (intel.heritage?.lpcProtected) {
    score -= 10;
    reasonsFr.push("Site patrimonial LPC à proximité — statut de la parcelle non établi");
    reasonsEn.push("LPC heritage site nearby — parcel status not established");
  } else if (intel.heritage?.pum2050Listed) {
    score -= 8;
    reasonsFr.push("Signal patrimonial PUM 2050 à proximité");
    reasonsEn.push("PUM 2050 heritage signal nearby");
  } else if (intel.heritage?.hasEip) {
    score -= 8;
    reasonsFr.push("Énoncé d'intérêt patrimonial à proximité — parcelle à confirmer");
    reasonsEn.push("Heritage interest statement nearby — parcel confirmation required");
  } else if (intel.heritage?.nearby) {
    score -= 12;
    reasonsFr.push("Édifice patrimonial à proximité");
    reasonsEn.push("Heritage building nearby");
  }

  if (intel.developmentProjects?.nearby && (intel.developmentProjects.count ?? 0) > 0) {
    score += 8;
    reasonsFr.push("Projets résidentiels actifs à proximité");
    reasonsEn.push("Active residential projects nearby");
  }

  if (
    intel.permitDelays?.medianDays != null &&
    intel.permitDelays.targetDays != null &&
    intel.permitDelays.medianDays > intel.permitDelays.targetDays * 1.25
  ) {
    score -= 10;
    reasonsFr.push("Délais de permis au-dessus de la cible municipale");
    reasonsEn.push("Permit delays above municipal target");
  }

  const gap = computeDensityGap(intel);
  if (gap.densityGap === "upside") {
    score += 20;
    reasonsFr.push(gap.densityGapLabelFr ?? "Marge de densité possible");
    reasonsEn.push(gap.densityGapLabelEn ?? "Density upside possible");
  } else if (gap.densityGap === "at_capacity") {
    score -= 10;
    reasonsFr.push("Capacité apparente atteinte selon des règles parcellaires confirmées");
    reasonsEn.push("Apparent capacity reached under confirmed parcel rules");
  }

  if (intel.marketHeat?.level === "hot") {
    score += 15;
    reasonsFr.push("Marché des permis actif dans l'arrondissement");
    reasonsEn.push("Hot permit market in borough");
  }

  if (intel.recentTransaction?.salePrice && intel.recentTransaction.salePrice > 500_000) {
    score += 10;
    reasonsFr.push("Transaction récente significative");
    reasonsEn.push("Significant recent transaction");
  }

  if (intel.assessment?.totalValue && intel.assessment.totalValue > 1_000_000) {
    score += 8;
  }

  let tier: VerdictTier;
  if (score >= 70) {
    tier = "eleve";
  } else if (score >= 45) {
    tier = "moyen";
  } else {
    tier = "faible";
  }

  const labels: Record<VerdictTier, { fr: string; en: string }> = {
    insufficient_data: { fr: "Donnees insuffisantes", en: "Insufficient data" },
    eleve: { fr: "Potentiel élevé", en: "High potential" },
    moyen: { fr: "Potentiel moyen", en: "Moderate potential" },
    faible: { fr: "Potentiel faible", en: "Low potential" },
    bloque: { fr: "Bloqué / risque élevé", en: "Blocked / high risk" },
  };

  if (!intel.zoning) {
    limitations.push("No parcel-to-zone evidence was available; zoning conclusions are incomplete.");
  }
  if (!intel.assessment) {
    limitations.push("No property-assessment evidence was available for this address.");
  }
  if (intel.contamination?.nearby || intel.contamination?.gtcNearby) {
    limitations.push(
      "Environmental records were found by proximity only; this does not establish that the subject parcel is contaminated.",
    );
  }
  if (intel.heritage?.nearby) {
    limitations.push(
      "Heritage records were found by proximity only; this does not establish a legal designation on the subject parcel.",
    );
  }

  return {
    tier,
    labelFr: labels[tier].fr,
    labelEn: labels[tier].en,
    reasonsFr,
    reasonsEn,
    score,
    confidence: Math.max(0.1, Math.min(0.95, (reasonsFr.length + (intel.zoning ? 1 : 0)) / 8)),
    limitations,
    densityGap: gap.densityGap,
  };
}
