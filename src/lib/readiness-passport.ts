import type { GovernmentReadinessPassport } from "@/lib/domain/quebec";

type Locale = "fr" | "en";

export type ReadinessProfile = {
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
  // Tracked compliance profile (user-declared unless a verified adapter exists).
  neq?: string | null;
  revenuQuebecStatus?: string | null;
  revenuQuebecExpiresAt?: Date | string | null;
  cnesstStatus?: string | null;
  oqlfStatus?: string | null;
  insuranceCarrier?: string | null;
  insuranceExpiresAt?: Date | string | null;
  insuranceLimit?: number | null;
  bidBondCapacity?: number | null;
  lobbyismDeclarationOnFile?: boolean | null;
  signingResolutionOnFile?: boolean | null;
  referencesCount?: number | null;
  employeesCount?: number | null;
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

/** True when a status field carries a valid, non-expired value. */
function statusValid(value?: string | null): boolean {
  return value === "valid" || value === "compliant";
}

/** True when a date is present and not in the past. */
function notExpired(value?: Date | string | null): boolean {
  if (!value) return false;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isFinite(d.getTime()) && d.getTime() >= Date.now();
}

/**
 * Parse a persisted list string into a `string[]`. The settings API stores
 * these as `JSON.stringify(["a","b"])`; older/manual values may be plain
 * comma-separated. Both shapes are handled.
 */
function parseList(value?: string | null): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((s) => String(s).trim()).filter(Boolean);
      }
    } catch {
      /* fall through to comma split */
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build a ReadinessProfile from a raw Prisma User row, parsing the
 * persisted `trades`/`regions` strings. Tolerates partial rows
 * (registration / preview contexts).
 */
export function profileFromUser(user: {
  companyName?: string | null;
  email?: string | null;
  name?: string | null;
  rbqLicenseClass?: string | null;
  rbqLicenseNumber?: string | null;
  rbqVerified?: boolean | null;
  trades?: string | null;
  regions?: string | null;
  ampAuthorized?: boolean | null;
  minProjectCost?: number | null;
  maxProjectCost?: number | null;
  neq?: string | null;
  revenuQuebecStatus?: string | null;
  revenuQuebecExpiresAt?: Date | string | null;
  cnesstStatus?: string | null;
  oqlfStatus?: string | null;
  insuranceCarrier?: string | null;
  insuranceExpiresAt?: Date | string | null;
  insuranceLimit?: number | null;
  bidBondCapacity?: number | null;
  lobbyismDeclarationOnFile?: boolean | null;
  signingResolutionOnFile?: boolean | null;
  referencesCount?: number | null;
  employeesCount?: number | null;
}): ReadinessProfile {
  return {
    companyName: user.companyName ?? user.name ?? null,
    email: user.email ?? null,
    rbqLicenseClass: user.rbqLicenseClass ?? null,
    rbqLicenseNumber: user.rbqLicenseNumber ?? null,
    rbqVerified: user.rbqVerified ?? false,
    trades: parseList(user.trades),
    regions: parseList(user.regions),
    ampAuthorized: user.ampAuthorized ?? false,
    minProjectCost: user.minProjectCost ?? null,
    maxProjectCost: user.maxProjectCost ?? null,
    neq: user.neq ?? null,
    revenuQuebecStatus: user.revenuQuebecStatus ?? null,
    revenuQuebecExpiresAt: user.revenuQuebecExpiresAt ?? null,
    cnesstStatus: user.cnesstStatus ?? null,
    oqlfStatus: user.oqlfStatus ?? null,
    insuranceCarrier: user.insuranceCarrier ?? null,
    insuranceExpiresAt: user.insuranceExpiresAt ?? null,
    insuranceLimit: user.insuranceLimit ?? null,
    bidBondCapacity: user.bidBondCapacity ?? null,
    lobbyismDeclarationOnFile: user.lobbyismDeclarationOnFile ?? false,
    signingResolutionOnFile: user.signingResolutionOnFile ?? false,
    referencesCount: user.referencesCount ?? 0,
    employeesCount: user.employeesCount ?? 0,
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

  // Tracked compliance checks — these are real scored items now (no longer
  // text-only). They are *bonus* points layered on top of the 80-point core,
  // capped at 100, so a complete core profile still reaches "ready" without
  // them. They surface as missing items and feed per-opportunity verdicts.
  const insuranceReady =
    Boolean(profile.insuranceCarrier) &&
    notExpired(profile.insuranceExpiresAt) &&
    (profile.insuranceLimit ?? 0) > 0;
  const compliance = [
    add(
      Boolean(profile.neq),
      copy(locale, "NEQ (numéro d'entreprise du Québec) enregistré.", "NEQ (Quebec enterprise number) recorded."),
      copy(locale, "Numéro d'entreprise du Québec (NEQ) / Registraire.", "Quebec enterprise number (NEQ) / enterprise register."),
      3,
    ),
    add(
      statusValid(profile.revenuQuebecStatus) ||
        (profile.revenuQuebecStatus === "valid" && notExpired(profile.revenuQuebecExpiresAt)),
      copy(locale, "Attestation Revenu Québec déclarée valide.", "Revenu Québec attestation declared valid."),
      copy(locale, "Attestation Revenu Québec valide (requis pour soumettre).", "Valid Revenu Québec attestation (required to submit)."),
      3,
    ),
    add(
      Boolean(profile.cnesstStatus) &&
        (statusValid(profile.cnesstStatus) ||
          profile.cnesstStatus === "agency_permit_required"),
      copy(locale, "Statut CNESST déclaré.", "CNESST status declared."),
      copy(locale, "Statut CNESST (sécurité / main-d'oeuvre / permis d'agence).", "CNESST status (safety / staffing / agency permit)."),
      2,
    ),
    add(
      Boolean(profile.oqlfStatus) && profile.oqlfStatus !== "missing",
      copy(locale, "Statut OQLF/francisation déclaré.", "OQLF/francization status declared."),
      copy(locale, "Statut OQLF / francisation si applicable.", "OQLF / francization status if applicable."),
      2,
    ),
    add(
      insuranceReady,
      copy(locale, "Certificat d'assurance responsabilité enregistré et à jour.", "Liability insurance certificate recorded and current."),
      copy(locale, "Certificat d'assurance (montant + expiration).", "Insurance certificate (amount + expiry)."),
      3,
    ),
    add(
      (profile.bidBondCapacity ?? 0) > 0,
      copy(locale, "Capacité de cautionnement déclarée.", "Bonding capacity declared."),
      copy(locale, "Capacité de cautionnement (souvent exigée pour les marchés publics).", "Bonding capacity (often required for public tenders)."),
      2,
    ),
    add(
      Boolean(profile.lobbyismDeclarationOnFile),
      copy(locale, "Déclaration de lobbyisme / non-collusion en dossier.", "Lobbying / non-collusion declaration on file."),
      copy(locale, "Gabarit de déclaration lobbyisme / non-collusion.", "Lobbying / non-collusion declaration template."),
      2,
    ),
    add(
      Boolean(profile.signingResolutionOnFile) && (profile.referencesCount ?? 0) > 0,
      copy(locale, "Résolution de signature et références de projets prêtes.", "Signing resolution and project references ready."),
      copy(locale, "Références de projets et résolution de signature.", "Project references and signing resolution."),
      3,
    ),
  ];

  const allChecks = [...checks, ...compliance];
  const readyItems = allChecks.flatMap((check) => check.ready);
  const missingItems = [
    ...allChecks.flatMap((check) => check.missing),
  ];
  const score = Math.min(100, allChecks.reduce((sum, check) => sum + check.points, 0));
  const blockers = [
    !profile.rbqLicenseNumber || !profile.rbqLicenseClass
      ? copy(locale, "RBQ incomplet : impossible de qualifier plusieurs appels de construction.", "Incomplete RBQ: many construction tenders cannot be qualified.")
      : "",
    !profile.ampAuthorized
      ? copy(locale, "AMP non confirmé : risque de blocage sur contrats publics au-dessus des seuils.", "AMP not confirmed: blocker risk on public contracts above thresholds.")
      : "",
    !statusValid(profile.revenuQuebecStatus)
      ? copy(locale, "Attestation Revenu Québec non déclarée : sera un bloqueur de soumission sur les marchés publics.", "Revenu Québec attestation not declared: it will block submission on public tenders.")
      : "",
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
    missionBoard: [
      {
        id: "neq",
        step: 1,
        title: copy(locale, "Vérifier le NEQ", "Verify NEQ"),
        detail: copy(locale, "Confirmer le numéro d'entreprise du Québec au Registraire des entreprises.", "Confirm the Quebec enterprise number on the enterprise register."),
        status: profile.neq ? "ready" : "todo",
        buttonLabel: copy(locale, "Ouvrir le Registraire", "Open register"),
        href: "https://www.registreentreprises.gouv.qc.ca",
      },
      {
        id: "rbq",
        step: 2,
        title: copy(locale, "Vérifier la classe de licence RBQ", "Check RBQ licence class"),
        detail: copy(locale, "La sous-catégorie RBQ doit couvrir les travaux de l'appel d'offres.", "The RBQ subclass must cover the tender's scope of work."),
        status: profile.rbqLicenseNumber && profile.rbqLicenseClass ? "ready" : "blocked",
        buttonLabel: copy(locale, "Ouvrir RBQ", "Open RBQ"),
        href: "https://www.rbq.gouv.qc.ca/en/",
      },
      {
        id: "revenu-quebec",
        step: 3,
        title: copy(locale, "Obtenir l'attestation Revenu Québec", "Get Revenu Québec attestation"),
        detail: copy(locale, "Attestation obligatoire à joindre à toute soumission de marché public.", "Mandatory attestation to attach to every public-tender submission."),
        status: statusValid(profile.revenuQuebecStatus) ? "ready" : "blocked",
        buttonLabel: copy(locale, "Ouvrir Revenu Québec", "Open Revenu Québec"),
        href: "https://www.revenuquebec.ca/en/",
      },
      {
        id: "rena",
        step: 4,
        title: copy(locale, "Vérifier RENA", "Check RENA"),
        detail: copy(locale, "Registre des entreprises du gouvernement du Canada si le contrat est fédéral.", "Federal enterprise registry if the contract is federal."),
        status: "verify",
        buttonLabel: copy(locale, "Vérifier", "Check"),
        href: "https://www.ic.gc.ca/app/scr/cc/CorporationsCanada/fdrlCrpInq.html",
      },
      {
        id: "amp",
        step: 5,
        title: copy(locale, "Vérifier le seuil AMP", "Verify AMP threshold"),
        detail: copy(locale, "Autorisation requise pour construction/PPP de 5M$+ et services de 1M$+, détenue à la date de dépôt.", "Required for construction/PPP $5M+ and services $1M+, held on the submission date."),
        status: profile.ampAuthorized ? "ready" : "todo",
        buttonLabel: copy(locale, "Ouvrir AMP", "Open AMP"),
        href: "https://www.amp.quebec/en/autorisation-de-contracter",
      },
      {
        id: "cnesst",
        step: 6,
        title: copy(locale, "Vérifier le risque CNESST", "Check CNESST risk"),
        detail: copy(locale, "Permis d'agence requis pour la main-d'oeuvre; obligations de sécurité selon le contrat.", "Agency permit needed for staffing; safety obligations per contract."),
        status: profile.cnesstStatus ? "ready" : "verify",
        buttonLabel: copy(locale, "Ouvrir CNESST", "Open CNESST"),
        href: "https://www.cnesst.gouv.qc.ca/en",
      },
      {
        id: "addenda",
        step: 7,
        title: copy(locale, "Lire les addendas", "Read addenda"),
        detail: copy(locale, "Tout addenda publié modifie l'appel; une soumission ignorée peut être rejetée.", "Every published addendum amends the tender; ignoring one can cause rejection."),
        status: "todo",
        buttonLabel: copy(locale, "Vérifier les addendas", "Check addenda"),
        href: "/triage",
      },
      {
        id: "lobbyism",
        step: 8,
        title: copy(locale, "Remplir la déclaration lobbyisme", "Fill lobbying declaration"),
        detail: copy(locale, "Formulaire obligatoire à inclure dans toutes les soumissions au Québec.", "Mandatory form to include in all Quebec submissions."),
        status: profile.lobbyismDeclarationOnFile ? "ready" : "todo",
        buttonLabel: copy(locale, "Préparer", "Prepare"),
        href: "https://www.quebec.ca/gouvernement/politiques/lobbyisme",
      },
      {
        id: "insurance",
        step: 9,
        title: copy(locale, "Préparer l'assurance et le cautionnement", "Prepare insurance and bonding"),
        detail: copy(locale, "Certificat d'assurance et capacité de cautionnement souvent exigés.", "Insurance certificate and bonding capacity often required."),
        status: insuranceReady ? "ready" : "todo",
        buttonLabel: copy(locale, "Ouvrir les réglages", "Open settings"),
        href: "/settings",
      },
      {
        id: "references",
        step: 10,
        title: copy(locale, "Préparer références et résolution", "Prepare references and resolution"),
        detail: copy(locale, "Références de projets et résolution de signature de l'entreprise.", "Project references and the company's signing resolution."),
        status: profile.signingResolutionOnFile && (profile.referencesCount ?? 0) > 0 ? "ready" : "todo",
        buttonLabel: copy(locale, "Ouvrir les réglages", "Open settings"),
        href: "/settings",
      },
      {
        id: "pricing",
        step: 11,
        title: copy(locale, "Préparer la grille de prix", "Prepare price sheet"),
        detail: copy(locale, "Compléter le formulaire de prix selon le format exigé.", "Complete the price form in the required format."),
        status: "todo",
        buttonLabel: copy(locale, "Voir l'appel", "View tender"),
        href: "/triage",
      },
      {
        id: "submit",
        step: 12,
        title: copy(locale, "Soumettre avant l'échéance", "Submit before deadline"),
        detail: copy(locale, "Respecter la date/heure limite et le mode de dépôt (électronique ou physique).", "Respect the deadline date/time and submission mode (electronic or physical)."),
        status: "todo",
        buttonLabel: copy(locale, "Voir l'appel", "View tender"),
        href: "/triage",
      },
    ],
  };
}
