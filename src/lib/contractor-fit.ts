export type ContractorTenderFit = {
  score: number;
  level: "strong" | "related" | "support" | "weak";
  contractorWork: boolean;
  reasonsFr: string[];
  reasonsEn: string[];
};

type TenderLike = {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  organization?: string | null;
};

type PermitLike = {
  permitType?: string | null;
  workType?: string | null;
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(normalize(term)));
}

const EXECUTION_TERMS = [
  "travaux",
  "construction",
  "renovation",
  "réfection",
  "rehabilitation",
  "demolition",
  "démolition",
  "excavation",
  "pavage",
  "asphalt",
  "asphalte",
  "voirie",
  "aqueduc",
  "egout",
  "égout",
  "drainage",
  "toiture",
  "enveloppe",
  "fenetre",
  "fenêtre",
  "portes",
  "mecanique",
  "mécanique",
  "electric",
  "électri",
  "plomberie",
  "ventilation",
  "cvac",
  "escaliers",
  "stationnement",
  "amenagement",
  "aménagement",
];

const PROFESSIONAL_SERVICE_TERMS = [
  "services professionnels",
  "ingenierie",
  "ingénierie",
  "architecture",
  "architecte",
  "etude",
  "étude",
  "conception",
  "surveillance",
  "protocole",
  "suivi ecologique",
  "suivi écologique",
  "analyse",
  "audit",
  "consultant",
  "consultation",
];

const STUDY_OR_MONITORING_TERMS = [
  "protocole",
  "suivi ecologique",
  "suivi écologique",
  "monitoring",
  "etude environnementale",
  "étude environnementale",
  "caracterisation",
  "caractérisation",
  "plan directeur",
];

const NON_CONTRACTOR_TERMS = [
  "logiciel",
  "informatique",
  "cyber",
  "telecommunication",
  "télécommunication",
  "formation",
  "alimentaire",
  "traiteur",
  "assurance",
  "banque",
  "medical",
  "médical",
  "vehicule",
  "véhicule",
];

const SUPPLY_TERMS = [
  "fourniture",
  "materiaux",
  "matériaux",
  "location",
  "equipement",
  "équipement",
];

const HIGH_SIGNAL_PERMIT_TERMS = [
  "construction",
  "renovation",
  "rénovation",
  "refection",
  "réfection",
  "transformation",
  "agrandissement",
  "demolition",
  "démolition",
  "excavation",
  "fondation",
  "structure",
  "toiture",
  "electricite",
  "électricité",
  "plomberie",
  "mecanique",
  "mécanique",
  "ventilation",
  "commercial",
  "industriel",
  "multifamilial",
];

const LOW_SIGNAL_PERMIT_TERMS = [
  "abattage",
  "arbre",
  "cloture",
  "clôture",
  "piscine",
  "cabanon",
  "remise",
  "enseigne",
  "certificat",
  "autorisation",
  "occupation",
  "terrasse",
  "solarium",
  "spa",
];

export function classifyContractorTender(tender: TenderLike): ContractorTenderFit {
  const title = normalize(tender.title ?? "");
  const category = normalize(tender.category ?? "");
  const description = normalize(tender.description ?? "");
  const text = [title, category, description].filter(Boolean).join(" ");

  const hasExecution = includesAny(text, EXECUTION_TERMS);
  const hasProfessionalService = includesAny(text, PROFESSIONAL_SERVICE_TERMS);
  const hasStudyOrMonitoring = includesAny(text, STUDY_OR_MONITORING_TERMS);
  const hasNonContractor = includesAny(text, NON_CONTRACTOR_TERMS);
  const hasSupply = includesAny(text, SUPPLY_TERMS);

  if (hasStudyOrMonitoring) {
    return {
      score: 12,
      level: "weak",
      contractorWork: false,
      reasonsFr: ["Le dossier semble viser une étude, un protocole ou un suivi plutôt que des travaux à exécuter."],
      reasonsEn: ["The file appears to target a study, protocol, or monitoring work rather than executable work."],
    };
  }

  if (hasNonContractor) {
    return {
      score: 10,
      level: "weak",
      contractorWork: false,
      reasonsFr: ["Le libellé ressemble peu à un contrat de construction exécutable."],
      reasonsEn: ["The wording does not look like executable construction work."],
    };
  }

  if (hasProfessionalService && !title.includes("travaux de")) {
    return {
      score: hasExecution ? 25 : 15,
      level: "weak",
      contractorWork: false,
      reasonsFr: ["Le dossier semble viser des services professionnels plutôt que des travaux à exécuter."],
      reasonsEn: ["The file appears to target professional services rather than executable work."],
    };
  }

  if (hasExecution) {
    return {
      score: 100,
      level: "strong",
      contractorWork: true,
      reasonsFr: ["Le libellé indique des travaux de construction ou de réfection à exécuter."],
      reasonsEn: ["The wording indicates construction or rehabilitation work to execute."],
    };
  }

  if (hasSupply) {
    return {
      score: 55,
      level: "support",
      contractorWork: true,
      reasonsFr: ["Le dossier touche des matériaux ou équipements liés au chantier."],
      reasonsEn: ["The file relates to jobsite materials or equipment."],
    };
  }

  return {
    score: 30,
    level: "related",
    contractorWork: false,
    reasonsFr: ["Le lien avec des travaux de construction doit être confirmé dans les documents officiels."],
    reasonsEn: ["The link to construction work must be confirmed in the official documents."],
  };
}

export function classifyContractorPermit(permit: PermitLike): ContractorTenderFit {
  const permitType = normalize(permit.permitType ?? "");
  const workType = normalize(permit.workType ?? "");
  const text = [permitType, workType].filter(Boolean).join(" ");

  const hasHighSignal = includesAny(text, HIGH_SIGNAL_PERMIT_TERMS);
  const hasLowSignal = includesAny(text, LOW_SIGNAL_PERMIT_TERMS);
  const genericConstructionOnly = [
    "construction",
    "permis construction",
    "permis de construction",
  ].includes(text);

  if (hasHighSignal && !genericConstructionOnly) {
    return {
      score: 100,
      level: "strong",
      contractorWork: true,
      reasonsFr: ["Le permis indique des travaux de construction, transformation ou métier à qualifier."],
      reasonsEn: ["The permit indicates construction, renovation, or trade work to qualify."],
    };
  }

  if (hasLowSignal) {
    return {
      score: 18,
      level: "weak",
      contractorWork: false,
      reasonsFr: ["Le permis ressemble à un petit dossier administratif ou extérieur plutôt qu'à une occasion de chantier."],
      reasonsEn: ["The permit looks like a small administrative or exterior file rather than a jobsite opportunity."],
    };
  }

  return {
    score: 42,
    level: "related",
    contractorWork: false,
    reasonsFr: ["La portée des travaux doit être confirmée avant de traiter ce permis comme une occasion."],
    reasonsEn: ["The work scope must be confirmed before treating this permit as an opportunity."],
  };
}
