import type { ReadinessProfile } from "@/lib/readiness-passport";
import type { OpportunityDossier } from "@/lib/domain/quebec";
import type { VaultExtraction } from "@/lib/vault/extract";

type Locale = "fr" | "en";

function copy(locale: Locale, fr: string, en: string) {
  return locale === "fr" ? fr : en;
}

export type CapabilityStatement = {
  title: string;
  sections: { heading: string; body: string }[];
};

export type ProposalOutline = {
  title: string;
  sections: { heading: string; items: string[]; mandatory: boolean }[];
};

export type PricingSkeleton = {
  title: string;
  disclaimer: string;
  lineItems: { label: string; note: string }[];
};

type TenderInput = {
  title: string;
  organization?: string | null;
  region?: string | null;
  category?: string | null;
  estimatedValue?: number | null;
  sourceUrl: string;
};

type MissionInput = NonNullable<OpportunityDossier["governmentMission"]>;

export function buildCapabilityStatement(
  profile: ReadinessProfile,
  locale: Locale,
): CapabilityStatement {
  const sections: CapabilityStatement["sections"] = [
    {
      heading: copy(locale, "Identité de l'entreprise", "Company identity"),
      body: [
        profile.companyName,
        profile.email ? copy(locale, `Courriel : ${profile.email}`, `Email: ${profile.email}`) : null,
        profile.neq ? copy(locale, `NEQ : ${profile.neq}`, `NEQ: ${profile.neq}`) : copy(locale, "NEQ : à confirmer", "NEQ: to confirm"),
      ]
        .filter(Boolean)
        .join("\n"),
    },
    {
      heading: copy(locale, "Licence RBQ", "RBQ licence"),
      body: [
        profile.rbqLicenseNumber
          ? copy(locale, `Numéro : ${profile.rbqLicenseNumber}`, `Number: ${profile.rbqLicenseNumber}`)
          : copy(locale, "Numéro RBQ : à configurer", "RBQ number: configure in settings"),
        profile.rbqLicenseClass
          ? copy(locale, `Classe/sous-catégorie : ${profile.rbqLicenseClass}`, `Class/subclass: ${profile.rbqLicenseClass}`)
          : copy(locale, "Classe RBQ : à configurer", "RBQ class: configure in settings"),
        profile.rbqVerified
          ? copy(locale, "Statut : vérifié dans les données indexées", "Status: verified in indexed data")
          : copy(locale, "Statut : déclaré — à vérifier", "Status: declared — verify"),
      ].join("\n"),
    },
    {
      heading: copy(locale, "Métiers et territoires", "Trades and regions"),
      body: [
        profile.trades.length > 0
          ? copy(locale, `Métiers : ${profile.trades.join(", ")}`, `Trades: ${profile.trades.join(", ")}`)
          : copy(locale, "Métiers : à configurer", "Trades: configure in settings"),
        profile.regions.length > 0
          ? copy(locale, `Régions : ${profile.regions.join(", ")}`, `Regions: ${profile.regions.join(", ")}`)
          : copy(locale, "Régions : à configurer", "Regions: configure in settings"),
      ].join("\n"),
    },
    {
      heading: copy(locale, "Autorisations et conformité", "Authorizations and compliance"),
      body: [
        profile.ampAuthorized
          ? copy(locale, "AMP : autorisé (déclaré)", "AMP: authorized (declared)")
          : copy(locale, "AMP : non déclaré — vérifier les seuils", "AMP: not declared — verify thresholds"),
        profile.revenuQuebecStatus === "valid"
          ? copy(locale, "Attestation Revenu Québec : valide (déclarée)", "Revenu Québec attestation: valid (declared)")
          : copy(locale, "Attestation Revenu Québec : à obtenir", "Revenu Québec attestation: obtain before bid"),
        profile.insuranceCarrier
          ? copy(locale, `Assurance : ${profile.insuranceCarrier}`, `Insurance: ${profile.insuranceCarrier}`)
          : copy(locale, "Assurance : à documenter", "Insurance: document before bid"),
      ].join("\n"),
    },
    {
      heading: copy(locale, "Capacité et références", "Capacity and references"),
      body: [
        profile.employeesCount
          ? copy(locale, `Employés : ${profile.employeesCount}`, `Employees: ${profile.employeesCount}`)
          : null,
        profile.referencesCount
          ? copy(locale, `Références de projets : ${profile.referencesCount}`, `Project references: ${profile.referencesCount}`)
          : copy(locale, "Références : à préparer", "References: prepare before bid"),
        profile.minProjectCost != null || profile.maxProjectCost != null
          ? copy(
              locale,
              `Fourchette de contrats : ${profile.minProjectCost ?? "—"} $ – ${profile.maxProjectCost ?? "—"} $`,
              `Contract range: $${profile.minProjectCost ?? "—"} – $${profile.maxProjectCost ?? "—"}`,
            )
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  return {
    title: copy(
      locale,
      `Énoncé de capacités — ${profile.companyName ?? "Entreprise"}`,
      `Capability statement — ${profile.companyName ?? "Company"}`,
    ),
    sections,
  };
}

export function buildProposalOutline(input: {
  tender: TenderInput;
  mission?: MissionInput;
  vaultExtraction?: VaultExtraction | null;
  locale: Locale;
}): ProposalOutline {
  const { tender, mission, vaultExtraction, locale } = input;
  const sections: ProposalOutline["sections"] = [
    {
      heading: copy(locale, "1. Lettre de soumission", "1. Bid letter"),
      items: [
        copy(locale, "Identité légale, NEQ, signataire autorisé", "Legal identity, NEQ, authorized signatory"),
        copy(locale, "Déclaration de non-collusion / lobbyisme", "Non-collusion / lobbying declaration"),
      ],
      mandatory: true,
    },
    {
      heading: copy(locale, "2. Attestations obligatoires", "2. Mandatory attestations"),
      items: mission?.requiredDocuments.length
        ? mission.requiredDocuments
        : [
            copy(locale, "Attestation Revenu Québec", "Revenu Québec attestation"),
            copy(locale, "Licence RBQ applicable", "Applicable RBQ licence"),
          ],
      mandatory: true,
    },
  ];

  if (vaultExtraction?.tasks.length) {
    sections.push({
      heading: copy(locale, "3. Formulaires extraits du dossier", "3. Forms extracted from documents"),
      items: vaultExtraction.tasks
        .filter((t) => t.category === "mandatory_form" || t.blocker)
        .map((t) => t.title),
      mandatory: true,
    });
  }

  if (vaultExtraction?.rejectionRisks.length || mission?.rejectionRisks.length) {
    sections.push({
      heading: copy(locale, "4. Causes de rejet à éviter", "4. Rejection causes to avoid"),
      items: [
        ...(vaultExtraction?.rejectionRisks ?? []),
        ...(mission?.rejectionRisks ?? []),
      ].slice(0, 8),
      mandatory: false,
    });
  }

  sections.push({
    heading: copy(locale, "5. Bordereau de prix et dépôt", "5. Pricing sheet and submission"),
    items: [
      copy(locale, "Grille de prix selon le format exigé", "Pricing grid in required format"),
      vaultExtraction?.submissionMethod
        ? vaultExtraction.submissionMethod
        : copy(locale, "Méthode de dépôt à confirmer sur la source officielle", "Submission method — confirm on official source"),
      copy(locale, `Source officielle : ${tender.sourceUrl}`, `Official source: ${tender.sourceUrl}`),
    ],
    mandatory: true,
  });

  return {
    title: copy(locale, `Plan de soumission — ${tender.title}`, `Proposal outline — ${tender.title}`),
    sections,
  };
}

export function buildPricingSkeleton(input: {
  estimatedValue?: number | null;
  locale: Locale;
}): PricingSkeleton {
  const { estimatedValue, locale } = input;
  const base = estimatedValue ?? null;

  return {
    title: copy(locale, "Bordereau de prix (ébauche)", "Pricing sheet (draft)"),
    disclaimer: copy(
      locale,
      "Estimé — compléter avec vos coûts réels. Ne jamais soumettre sans revue interne.",
      "Estimated — fill with your actual costs. Never submit without internal review.",
    ),
    lineItems: [
      {
        label: copy(locale, "Main-d'œuvre", "Labour"),
        note: base
          ? copy(locale, `Réf. marché ~${Math.round(base * 0.35).toLocaleString()} $ (estimé)`, `Market ref ~$${Math.round(base * 0.35).toLocaleString()} (estimated)`)
          : copy(locale, "À estimer", "To estimate"),
      },
      {
        label: copy(locale, "Matériaux et équipement", "Materials and equipment"),
        note: base
          ? copy(locale, `Réf. marché ~${Math.round(base * 0.45).toLocaleString()} $ (estimé)`, `Market ref ~$${Math.round(base * 0.45).toLocaleString()} (estimated)`)
          : copy(locale, "À estimer", "To estimate"),
      },
      {
        label: copy(locale, "Sous-traitance", "Subcontractors"),
        note: copy(locale, "Inclure quotes signées si exigé", "Include signed quotes if required"),
      },
      {
        label: copy(locale, "Frais généraux et profit", "Overhead and profit"),
        note: copy(locale, "Typiquement 8–15 % selon risque", "Typically 8–15% depending on risk"),
      },
      {
        label: copy(locale, "Total proposé", "Proposed total"),
        note: base
          ? copy(locale, `Plafond indicatif ~${Math.round(base).toLocaleString()} $ (estimé)`, `Indicative ceiling ~$${Math.round(base).toLocaleString()} (estimated)`)
          : copy(locale, "À calculer", "To calculate"),
      },
    ],
  };
}

export function buildProposalPack(input: {
  profile: ReadinessProfile;
  tender: TenderInput;
  mission?: MissionInput;
  vaultExtraction?: VaultExtraction | null;
  locale: Locale;
}) {
  return {
    capabilityStatement: buildCapabilityStatement(input.profile, input.locale),
    proposalOutline: buildProposalOutline(input),
    pricingSkeleton: buildPricingSkeleton({
      estimatedValue: input.tender.estimatedValue,
      locale: input.locale,
    }),
  };
}
