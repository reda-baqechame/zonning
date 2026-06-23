import type { GovernmentReadinessPassport } from "@/lib/domain/quebec";

type Locale = "fr" | "en";

type ReadinessProfile = {
  companyName?: string | null;
  email?: string | null;
  rbqLicenseClass?: string | null;
  rbqLicenseNumber?: string | null;
  rbqVerified?: boolean | null;
  trades: string[];
  regions: string[];
  ampAuthorized?: boolean | null;
  minProjectCost?: number | null;
  maxProjectCost?: number | null;
};

function copy(locale: Locale, fr: string, en: string) {
  return locale === "fr" ? fr : en;
}

function add(
  ready: boolean,
  readyLabel: string,
  missingLabel: string,
  points: number,
) {
  return {
    points: ready ? points : 0,
    ready: ready ? [readyLabel] : [],
    missing: ready ? [] : [missingLabel],
  };
}

export function buildGovernmentReadinessPassport(
  profile: ReadinessProfile,
  locale: Locale,
): GovernmentReadinessPassport {
  const checks = [
    add(
      Boolean(profile.companyName && profile.email),
      copy(locale, "Identité d'entreprise configurée.", "Business identity is configured."),
      copy(locale, "Nom légal/entreprise et courriel de travail.", "Legal/company name and work email."),
      10,
    ),
    add(
      Boolean(profile.rbqLicenseNumber),
      copy(locale, "Numéro RBQ présent.", "RBQ number is present."),
      copy(locale, "Numéro de licence RBQ.", "RBQ licence number."),
      10,
    ),
    add(
      Boolean(profile.rbqLicenseClass),
      copy(locale, "Classe RBQ configurée.", "RBQ class is configured."),
      copy(locale, "Sous-catégorie/classe RBQ.", "RBQ subclass/class."),
      10,
    ),
    add(
      Boolean(profile.rbqVerified),
      copy(locale, "Licence RBQ vérifiée dans les données indexées.", "RBQ licence is verified in indexed data."),
      copy(locale, "Vérification active de la licence RBQ.", "Active RBQ licence verification."),
      10,
    ),
    add(
      profile.trades.length > 0,
      copy(locale, "Métiers cibles configurés.", "Target trades are configured."),
      copy(locale, "Métiers/services offerts.", "Trades/services offered."),
      10,
    ),
    add(
      profile.regions.length > 0,
      copy(locale, "Régions desservies configurées.", "Service regions are configured."),
      copy(locale, "Régions desservies.", "Service regions."),
      10,
    ),
    add(
      profile.minProjectCost != null || profile.maxProjectCost != null,
      copy(locale, "Plage de contrat préférée configurée.", "Preferred contract range is configured."),
      copy(locale, "Taille de contrat préférée.", "Preferred contract size."),
      10,
    ),
    add(
      Boolean(profile.ampAuthorized),
      copy(locale, "Autorisation AMP déclarée.", "AMP authorization is declared."),
      copy(locale, "Statut d'autorisation AMP.", "AMP authorization status."),
      10,
    ),
  ];

  const readyItems = checks.flatMap((check) => check.ready);
  const missingItems = [
    ...checks.flatMap((check) => check.missing),
    copy(locale, "Attestation Revenu Québec valide.", "Valid Revenu Québec attestation."),
    copy(locale, "Statut NEQ/Registraire à jour.", "NEQ/enterprise register status up to date."),
    copy(locale, "Statut CNESST si le dossier touche la main-d'oeuvre ou la sécurité.", "CNESST status if the file touches staffing or safety."),
    copy(locale, "Statut OQLF/francisation si applicable.", "OQLF/francization status if applicable."),
    copy(locale, "Certificat d'assurance et cautionnement.", "Insurance certificate and bonding."),
    copy(locale, "Gabarit de déclaration lobbyisme/non-collusion.", "Lobbying/non-collusion declaration template."),
    copy(locale, "Références de projets et résolution de signature.", "Project references and signing resolution."),
  ];
  const score = Math.min(100, checks.reduce((sum, check) => sum + check.points, 0));
  const blockers = [
    !profile.rbqLicenseNumber || !profile.rbqLicenseClass
      ? copy(locale, "RBQ incomplet : impossible de qualifier plusieurs appels de construction.", "Incomplete RBQ: many construction tenders cannot be qualified.")
      : "",
    !profile.ampAuthorized
      ? copy(locale, "AMP non confirmé : risque de blocage sur contrats publics au-dessus des seuils.", "AMP not confirmed: blocker risk on public contracts above thresholds.")
      : "",
    copy(locale, "Attestations externes non suivies dans ZONNING pour l'instant : Revenu Québec, CNESST, NEQ, OQLF, assurances.", "External attestations are not yet tracked in ZONNING: Revenu Québec, CNESST, NEQ, OQLF, insurance."),
  ].filter(Boolean);

  return {
    score,
    status: score >= 80 && blockers.length <= 1 ? "ready" : score >= 45 ? "partial" : "blocked",
    headline:
      score >= 80
        ? copy(locale, "Prêt pour une revue gouvernementale ciblée.", "Ready for targeted government-work review.")
        : score >= 45
          ? copy(locale, "Profil utilisable, mais plusieurs preuves bloquent encore les soumissions.", "Usable profile, but several proofs still block bids.")
          : copy(locale, "Profil trop incomplet pour dépenser sur des documents de soumission.", "Profile too incomplete to spend on tender documents."),
    readyItems,
    missingItems,
    blockers,
    nextActions: [
      {
        id: "complete-settings",
        label: copy(locale, "Compléter le profil ZONNING", "Complete the ZONNING profile"),
        detail: copy(locale, "RBQ, métiers, régions, budget et AMP alimentent les décisions acheter/ne pas acheter.", "RBQ, trades, regions, budget, and AMP drive buy/no-buy decisions."),
        buttonLabel: copy(locale, "Ouvrir les réglages", "Open settings"),
        href: "/settings",
        priority: "high",
      },
      {
        id: "amp",
        label: copy(locale, "Vérifier le statut AMP", "Verify AMP status"),
        detail: copy(locale, "L'autorisation doit être détenue à la date de dépôt si le seuil s'applique.", "Authorization must be held on submission date if the threshold applies."),
        buttonLabel: copy(locale, "Ouvrir AMP", "Open AMP"),
        href: "https://www.amp.quebec/en/autorisation-de-contracter",
        priority: "high",
      },
      {
        id: "revenue-quebec",
        label: copy(locale, "Préparer l'attestation Revenu Québec", "Prepare Revenu Québec attestation"),
        detail: copy(locale, "À vérifier avant d'engager du temps de prix sur un appel public.", "Verify before committing estimating time on a public tender."),
        buttonLabel: copy(locale, "Noter comme requis", "Mark required"),
        href: "/settings",
        priority: "medium",
      },
    ],
    officialSites: [
      {
        id: "seao",
        label: "SEAO",
        purpose: copy(locale, "Avis, documents, addendas, commandes et dépôt pour les marchés publics du Québec.", "Notices, documents, addenda, orders, and submission for Quebec public procurement."),
        accountRequired: copy(locale, "Compte SEAO requis pour certains documents/commandes.", "SEAO account required for some documents/orders."),
        href: "https://seao.ca",
      },
      {
        id: "amp",
        label: "AMP",
        purpose: copy(locale, "Autorisation de contracter et vérification des seuils publics.", "Authorization to contract and public-threshold checks."),
        accountRequired: copy(locale, "Services en ligne AMP/clicSÉQUR pour demander l'autorisation.", "AMP/clicSÉQUR online services for authorization applications."),
        href: "https://www.amp.quebec/en/autorisation-de-contracter",
      },
      {
        id: "rbq",
        label: "RBQ",
        purpose: copy(locale, "Licence entrepreneur et sous-catégories applicables.", "Contractor licence and applicable subclasses."),
        accountRequired: copy(locale, "Recherche publique; services RBQ selon la démarche.", "Public search; RBQ services depending on the task."),
        href: "https://www.rbq.gouv.qc.ca/en/",
      },
    ],
  };
}
