export const RBQ_LICENSE_CLASSES = [
  {
    code: "1.1.1",
    labelFr: "Entrepreneur général",
    labelEn: "General contractor",
  },
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
  electri: ["4.1"],
  plumbing: ["5.1"],
  plomber: ["5.1"],
  chauff: ["6.1"],
  hvac: ["6.1"],
  climatis: ["6.1"],
  maconner: ["7.1"],
  masonry: ["7.1"],
  charpent: ["8.1"],
  couvert: ["9.1"],
  toiture: ["9.1"],
  roofing: ["9.1"],
  beton: ["10.1"],
  concrete: ["10.1"],
  peintur: ["11.1"],
  renovation: ["1.2.1", "1.1.1"],
  construction: ["1.1.1"],
  demolition: ["1.1.1", "1.2.1"],
  commercial: ["1.1.1"],
  industriel: ["1.1.1"],
  industrial: ["1.1.1"],
  residentiel: ["1.2.1", "1.1.1"],
  residential: ["1.2.1", "1.1.1"],
};

function normalizeTradeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function getRequiredRbqClasses(
  permitType: string,
  workType?: string | null,
): string[] {
  const haystack = normalizeTradeText(`${permitType} ${workType ?? ""}`);
  const classes = new Set<string>();

  for (const [keyword, codes] of Object.entries(PERMIT_TYPE_TO_RBQ)) {
    if (haystack.includes(keyword)) {
      codes.forEach((c) => classes.add(c));
    }
  }

  return [...classes];
}

export function computeRbqFitScore(
  userLicenseClass: string | null | undefined,
  requiredClasses: string[],
): { score: number; eligible: boolean; reasonFr: string; reasonEn: string } {
  if (!userLicenseClass) {
    return {
      score: 0,
      eligible: false,
      reasonFr: "Ajoutez votre sous-classe RBQ dans votre profil",
      reasonEn: "Add your RBQ license subclass to your profile",
    };
  }

  if (requiredClasses.length === 0) {
    return {
      score: 50,
      eligible: false,
      reasonFr: "Sous-classe requise non déterminée à partir du permis",
      reasonEn: "Required subclass could not be inferred from the permit",
    };
  }

  const userClasses = userLicenseClass.match(/\d+(?:\.\d+)*/g) ?? [
    userLicenseClass.trim(),
  ];
  const eligible = userClasses.some((userClass) =>
    requiredClasses.includes(userClass),
  );
  const score = eligible ? 95 : 20;

  return {
    score,
    eligible,
    reasonFr: eligible
      ? `Sous-classe déclarée compatible: ${userLicenseClass}`
      : `Correspondance attendue: ${requiredClasses.join(", ")} — profil: ${userLicenseClass}`,
    reasonEn: eligible
      ? `Declared subclass match: ${userLicenseClass}`
      : `Expected match: ${requiredClasses.join(", ")} — profile: ${userLicenseClass}`,
  };
}
