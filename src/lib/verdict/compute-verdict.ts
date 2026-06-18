import type { PropertyIntelligence } from "@/lib/intelligence";
import { computeDensityGap } from "@/lib/pipeline-score";

export type VerdictTier = "eleve" | "moyen" | "faible" | "bloque";

export type VerdictResult = {
  tier: VerdictTier;
  labelFr: string;
  labelEn: string;
  reasonsFr: string[];
  reasonsEn: string[];
  densityGap?: string;
};

export function computeVerdictTier(intel: PropertyIntelligence): VerdictResult {
  const reasonsFr: string[] = [];
  const reasonsEn: string[] = [];
  let score = 50;

  if (intel.contamination?.gtcNearby) {
    score -= 45;
    reasonsFr.push("Terrain contaminé — répertoire provincial GTC");
    reasonsEn.push("Contaminated site — provincial GTC registry");
  } else if (intel.contamination?.nearby) {
    score -= 40;
    reasonsFr.push("Terrain contaminé à proximité");
    reasonsEn.push("Contaminated land nearby");
  }

  if (intel.heritage?.lpcProtected) {
    score -= 30;
    reasonsFr.push("Site protégé — Loi sur le patrimoine culturel");
    reasonsEn.push("Protected site under Cultural Heritage Act");
  } else if (intel.heritage?.pum2050Listed) {
    score -= 18;
    reasonsFr.push("Inscription patrimoine PUM 2050");
    reasonsEn.push("PUM 2050 heritage listing");
  } else if (intel.heritage?.hasEip) {
    score -= 25;
    reasonsFr.push("Énoncé d'intérêt patrimonial (EIP)");
    reasonsEn.push("Heritage interest statement (EIP)");
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
    reasonsFr.push("Densité à pleine capacité selon PUM");
    reasonsEn.push("At zoning capacity (PUM)");
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
  if (intel.contamination?.gtcNearby && (intel.contamination.gtcCount ?? 0) > 0) {
    tier = "bloque";
  } else if (intel.contamination?.nearby && intel.contamination.count > 2) {
    tier = "bloque";
  } else if (score >= 70) {
    tier = "eleve";
  } else if (score >= 45) {
    tier = "moyen";
  } else {
    tier = "faible";
  }

  const labels: Record<VerdictTier, { fr: string; en: string }> = {
    eleve: { fr: "Potentiel élevé", en: "High potential" },
    moyen: { fr: "Potentiel moyen", en: "Moderate potential" },
    faible: { fr: "Potentiel faible", en: "Low potential" },
    bloque: { fr: "Bloqué / risque élevé", en: "Blocked / high risk" },
  };

  return {
    tier,
    labelFr: labels[tier].fr,
    labelEn: labels[tier].en,
    reasonsFr,
    reasonsEn,
    densityGap: gap.densityGap,
  };
}
