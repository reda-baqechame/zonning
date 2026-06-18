export const RBQ_LICENSE_CLASSES = [
  { code: "1.1.1", labelFr: "Entrepreneur général", labelEn: "General contractor" },
  { code: "1.2.1", labelFr: "Petits travaux", labelEn: "Small works" },
  { code: "4.1", labelFr: "Électricité", labelEn: "Electrical" },
  { code: "5.1", labelFr: "Plomberie", labelEn: "Plumbing" },
  { code: "6.1", labelFr: "Chauffage et climatisation", labelEn: "HVAC" },
  { code: "7.1", labelFr: "Maçonnerie", labelEn: "Masonry" },
  { code: "8.1", labelFr: "Charpente", labelEn: "Carpentry" },
  { code: "9.1", labelFr: "Couverture", labelEn: "Roofing" },
  { code: "10.1", labelFr: "Béton", labelEn: "Concrete" },
  { code: "11.1", labelFr: "Peinture", labelEn: "Painting" },
] as const;

const PERMIT_TYPE_TO_RBQ: Record<string, string[]> = {
  électrique: ["4.1", "1.1.1"],
  electrical: ["4.1", "1.1.1"],
  plomberie: ["5.1", "1.1.1"],
  plumbing: ["5.1", "1.1.1"],
  chauffage: ["6.1", "1.1.1"],
  hvac: ["6.1", "1.1.1"],
  climatisation: ["6.1", "1.1.1"],
  maçonnerie: ["7.1", "1.1.1"],
  masonry: ["7.1", "1.1.1"],
  charpente: ["8.1", "1.1.1"],
  couverture: ["9.1", "1.1.1"],
  roofing: ["9.1", "1.1.1"],
  béton: ["10.1", "1.1.1"],
  concrete: ["10.1", "1.1.1"],
  rénovation: ["1.2.1", "1.1.1"],
  renovation: ["1.2.1", "1.1.1"],
  construction: ["1.1.1"],
  démolition: ["1.1.1", "1.2.1"],
  demolition: ["1.1.1", "1.2.1"],
  commercial: ["1.1.1"],
  industriel: ["1.1.1"],
  industrial: ["1.1.1"],
  résidentiel: ["1.2.1", "1.1.1"],
  residential: ["1.2.1", "1.1.1"],
};

export function getRequiredRbqClasses(
  permitType: string,
  workType?: string | null
): string[] {
  const haystack = `${permitType} ${workType ?? ""}`.toLowerCase();
  const classes = new Set<string>();

  for (const [keyword, codes] of Object.entries(PERMIT_TYPE_TO_RBQ)) {
    if (haystack.includes(keyword)) {
      codes.forEach((c) => classes.add(c));
    }
  }

  if (classes.size === 0) {
    classes.add("1.1.1");
  }

  return [...classes];
}

export function computeRbqFitScore(
  userLicenseClass: string | null | undefined,
  requiredClasses: string[]
): { score: number; eligible: boolean; reasonFr: string; reasonEn: string } {
  if (!userLicenseClass) {
    return {
      score: 0,
      eligible: false,
      reasonFr: "Ajoutez votre sous-classe RBQ dans votre profil",
      reasonEn: "Add your RBQ license subclass to your profile",
    };
  }

  if (userLicenseClass === "1.1.1") {
    return {
      score: 100,
      eligible: true,
      reasonFr: "Licence générale — couvre ce type de mandat",
      reasonEn: "General license — covers this project type",
    };
  }

  const eligible = requiredClasses.includes(userLicenseClass);
  const score = eligible ? 95 : requiredClasses.includes("1.1.1") ? 25 : 15;

  return {
    score,
    eligible,
    reasonFr: eligible
      ? `Votre licence ${userLicenseClass} couvre ce mandat`
      : `Requis: ${requiredClasses.join(", ")} — votre licence: ${userLicenseClass}`,
    reasonEn: eligible
      ? `Your license ${userLicenseClass} covers this project`
      : `Required: ${requiredClasses.join(", ")} — yours: ${userLicenseClass}`,
  };
}
