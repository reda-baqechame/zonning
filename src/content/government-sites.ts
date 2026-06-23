/**
 * Government Website Navigator — structured guides for every official Quebec
 * and federal site a contractor needs to win government work.
 *
 * All content is editorial guidance that points users to the OFFICIAL site. It
 * never bypasses logins, paywalls, or paid documents. Provenance is preserved
 * so the UI can attribute each site and link to the canonical source.
 */

export type Locale = "fr" | "en";

type Localized = { fr: string; en: string };

export type GuideStep = {
  title: Localized;
  detail: Localized;
};

export type GovernmentSiteGuide = {
  /** URL-safe slug used in /guides/[site]. */
  slug: string;
  /** Short display name. */
  name: string;
  /** Category for grouping on the index. */
  category: "procurement" | "licensing" | "compliance" | "register" | "data" | "municipal";
  /** What the site is for. */
  purpose: Localized;
  /** When you need it. */
  whenNeeded: Localized;
  /** Account/login requirements. */
  accountRequired: Localized;
  /** What documents or certificates it produces or holds. */
  produces: Localized;
  /** Official canonical URL. */
  href: string;
  /** Ordered how-to steps. */
  steps: GuideStep[];
  /** Common problems + fixes. */
  commonProblems: Localized[];
  /** Optional support contact line. */
  support?: Localized;
};

function L(fr: string, en: string): Localized {
  return { fr, en };
}

export const GOVERNMENT_SITE_GUIDES: GovernmentSiteGuide[] = [
  {
    slug: "seao",
    name: "SEAO",
    category: "procurement",
    purpose: L(
      "Le Système électronique d'appel d'offres (SEAO) du Québec : avis, documents, addendas, commandes, facturation et dépôt pour les marchés publics.",
      "Quebec's electronic tendering system (SEAO): notices, documents, addenda, orders, billing, and submission for public procurement.",
    ),
    whenNeeded: L(
      "Pour consulter, commander et déposer les documents de tout marché public québécois.",
      "To browse, order, and submit documents for any Quebec public tender.",
    ),
    accountRequired: L(
      "Compte SEAO requis pour commander/déposer certains documents. Le parcours des avis publics est possible sans compte.",
      "A SEAO account is required to order/submit some documents. Browsing public notices is possible without an account.",
    ),
    produces: L(
      "Avis d'appel d'offres, addendas, documents de soumission, historique de commandes et factures, informations de contrat.",
      "Tender notices, addenda, bid documents, order history and invoices, contract information.",
    ),
    href: "https://seao.ca",
    steps: [
      {
        title: L("Créer ou ouvrir un compte SEAO", "Create or open a SEAO account"),
        detail: L(
          "Choisissez le profil « Fournisseur » pour commander et déposer. Vérifiez votre courriel.",
          "Choose the 'Supplier' profile to order and submit. Verify your email.",
        ),
      },
      {
        title: L("Trouver l'avis", "Find the notice"),
        detail: L(
          "Recherchez par numéro d'avis, organisme ou mot-clé. Ouvrez la fiche de l'avis pour voir le résumé.",
          "Search by notice number, organization, or keyword. Open the notice record to see the summary.",
        ),
      },
      {
        title: L("Repérer le bouton « Commander »", "Locate the 'Order' (Commander) button"),
        detail: L(
          "Le bouton Commander apparaît sur la fiche de l'avis. Un cadenas signifie que le document est payant ou réservé aux titulaires de compte.",
          "The Order button appears on the notice record. A lock means the document is paid or account-restricted.",
        ),
      },
      {
        title: L("Vérifier les addendas", "Check the addenda"),
        detail: L(
          "Toujours télécharger tous les addendas publiés — ils modifient l'appel et une soumission qui les ignore peut être rejetée.",
          "Always download every published addendum — they amend the tender, and a bid that ignores them can be rejected.",
        ),
      },
      {
        title: L("Consulter l'historique de commandes et la facturation", "Review order history and billing"),
        detail: L(
          "Votre compte conserve l'historique de commandes, téléchargements, impressions, expéditions et factures.",
          "Your account keeps order history, downloads, printing, shipping, and invoices.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Document verrouillé : connectez-vous ou confirmez que votre profil est « Fournisseur ».",
        "Locked document: sign in or confirm your profile is 'Supplier'.",
      ),
      L(
        "Paiement requis : SEAO gère la facturation des documents payants via votre compte.",
        "Payment required: SEAO manages billing for paid documents through your account.",
      ),
      L(
        "PDF qui ne s'ouvre pas : utilisez une version récente d'Adobe Reader.",
        "PDF won't open: use a recent version of Adobe Reader.",
      ),
    ],
    support: L(
      "Support SEAO : consultez la section Aide de seao.ca pour le courriel/téléphone officiels.",
      "SEAO support: see the Help section on seao.ca for the official email/phone.",
    ),
  },
  {
    slug: "canadabuys",
    name: "CanadaBuys",
    category: "procurement",
    purpose: L(
      "Plateforme fédérale d'approvisionnement du gouvernement du Canada : avis de marchés, contrats et opportunités.",
      "Federal procurement platform for the Government of Canada: tender notices, contracts, and opportunities.",
    ),
    whenNeeded: L(
      "Pour les marchés fédéraux (biens 25 000 $+, services 40 000 $+).",
      "For federal tenders (goods $25k+, services $40k+).",
    ),
    accountRequired: L(
      "Compte à clé (Key) CanadaBuys pour soumissionner. La consultation des avis est publique.",
      "A CanadaBuys Key account to bid. Browsing notices is public.",
    ),
    produces: L(
      "Avis fédéraux, addendas, documents de soumission, résultats d'adjudication.",
      "Federal notices, addenda, bid documents, award results.",
    ),
    href: "https://canadabuys.canada.ca",
    steps: [
      {
        title: L("Créer un compte à clé (Key)", "Create a Key account"),
        detail: L(
          "Inscrivez-vous via le Guichet d'inscription pour obtenir votre identifiant Key.",
          "Register through the Registration portal to obtain your Key identifier.",
        ),
      },
      {
        title: L("Rechercher les opportunités", "Search opportunities"),
        detail: L(
          "Filtrez par département, UNSPSC, région et date de clôture.",
          "Filter by department, UNSPSC, region, and closing date.",
        ),
      },
      {
        title: L("Télécharger les documents et addendas", "Download documents and addenda"),
        detail: L(
          "Vérifiez les amendements avant de soumettre — ils modifient les exigences.",
          "Check amendments before bidding — they change requirements.",
        ),
      },
      {
        title: L("Soumettre via le portail", "Submit via the portal"),
        detail: L(
          "Déposez votre soumission avant la date/heure limite selon le mode exigé.",
          "Upload your bid before the deadline date/time in the required mode.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Connexion Key échouée : vérifiez votre identifiant et mot de passe fédéraux.",
        "Key login failed: verify your federal identifier and password.",
      ),
      L(
        "Devises et unités : les marchés fédéraux utilisent souvent l'anglais en priorité.",
        "Currencies and units: federal tenders often prioritize English.",
      ),
    ],
  },
  {
    slug: "rbq",
    name: "RBQ",
    category: "licensing",
    purpose: L(
      "Régie du bâtiment du Québec : licence d'entrepreneur, sous-catégories et registre public des licences.",
      "Régie du bâtiment du Québec: contractor licence, subclasses, and the public licence registry.",
    ),
    whenNeeded: L(
      "Pour toute entreprise qui exécute des travaux de construction soumis à licence au Québec.",
      "For any business performing licensed construction work in Quebec.",
    ),
    accountRequired: L(
      "Recherche publique sans compte. La gestion de licence se fait via clicSÉQUR.",
      "Public search without an account. Licence management is via clicSÉQUR.",
    ),
    produces: L(
      "Numéro et classe de licence RBQ, vérification d'une licence active, registre d'infractions.",
      "RBQ licence number and class, active-licence verification, infractions registry.",
    ),
    href: "https://www.rbq.gouv.qc.ca/en/",
    steps: [
      {
        title: L("Vérifier une licence", "Verify a licence"),
        detail: L(
          "Utilisez la recherche publique par numéro ou nom d'entreprise.",
          "Use the public search by number or business name.",
        ),
      },
      {
        title: L("Confirmer la sous-catégorie", "Confirm the subclass"),
        detail: L(
          "La sous-catégorie doit couvrir les travaux de l'appel d'offres, sinon la soumission est inadmissible.",
          "The subclass must cover the tender's scope, or the bid is ineligible.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Licence expirée : renouvelez avant de soumissionner.",
        "Expired licence: renew before bidding.",
      ),
    ],
  },
  {
    slug: "amp",
    name: "AMP",
    category: "compliance",
    purpose: L(
      "Autorité des marchés publics : autorisation de contracter avec un organisme public.",
      "Autorité des marchés publics: authorization to contract with a public body.",
    ),
    whenNeeded: L(
      "Construction/PPP 5 M$+ et services 1 M$+. L'autorisation doit être détenue à la date de dépôt.",
      "Construction/PPP $5M+ and services $1M+. Authorization must be held on the submission date.",
    ),
    accountRequired: L(
      "Services en ligne AMP via clicSÉQUR pour demander l'autorisation.",
      "AMP online services via clicSÉQUR to apply for authorization.",
    ),
    produces: L(
      "Autorisation de contracter (requise avec la soumission au-dessus des seuils).",
      "Authorization to contract (required with the submission above thresholds).",
    ),
    href: "https://www.amp.gouv.qc.ca/en/authorization-to-enter-into-contracts",
    steps: [
      {
        title: L("Vérifier le seuil applicable", "Verify the applicable threshold"),
        detail: L(
          "Déterminez si le contrat dépasse le seuil AMP avant d'investir du temps.",
          "Determine whether the contract exceeds the AMP threshold before investing time.",
        ),
      },
      {
        title: L("Demander l'autorisation à l'avance", "Apply for authorization in advance"),
        detail: L(
          "Le traitement prend du temps ; l'autorisation doit être valide à la date de dépôt.",
          "Processing takes time; authorization must be valid on the submission date.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Autorisation absente à la date de dépôt : rejet automatique.",
        "Missing authorization on the submission date: automatic rejection.",
      ),
    ],
  },
  {
    slug: "revenu-quebec",
    name: "Revenu Québec",
    category: "compliance",
    purpose: L(
      "Attestation de Revenu Québec requise pour soumissionner sur les marchés publics.",
      "Revenu Québec attestation required to bid on public tenders.",
    ),
    whenNeeded: L(
      "À joindre à toute soumission de marché public au Québec.",
      "To attach to every Quebec public-tender submission.",
    ),
    accountRequired: L(
      "ClicSÉQUR Revenu Québec pour obtenir l'attestation.",
      "clicSÉQUR Revenu Québec to obtain the attestation.",
    ),
    produces: L("Attestation de conformité fiscale.", "Tax compliance attestation."),
    href: "https://www.revenuquebec.ca/en/",
    steps: [
      {
        title: L("Obtenir l'attestation", "Obtain the attestation"),
        detail: L(
          "Connectez-vous et téléchargez l'attestation valide. Vérifiez la date d'expiration.",
          "Sign in and download the valid attestation. Check the expiry date.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Attestation expirée : rejet de la soumission. Renouvelez à temps.",
        "Expired attestation: bid rejected. Renew on time.",
      ),
    ],
  },
  {
    slug: "cnesst",
    name: "CNESST",
    category: "compliance",
    purpose: L(
      "Commission des normes, de l'équité, de la santé et de la sécurité du travail : permis d'agence, obligations de sécurité.",
      "Labour standards, equity, and occupational health & safety commission: agency permit, safety obligations.",
    ),
    whenNeeded: L(
      "Main-d'œuvre/location d'employés (permis d'agence) et obligations de sécurité sur les chantiers.",
      "Staffing/employee leasing (agency permit) and safety obligations on worksites.",
    ),
    accountRequired: L(
      "Services en ligne CNESST via clicSÉQUR pour le permis d'agence et les attestations.",
      "CNESST online services via clicSÉQUR for the agency permit and attestations.",
    ),
    produces: L(
      "Permis d'agence de placement, attestation de conformité LSST.",
      "Agency placement permit, LSST compliance attestation.",
    ),
    href: "https://www.cnesst.gouv.qc.ca/en",
    steps: [
      {
        title: L("Évaluer le risque permis d'agence", "Assess agency-permit risk"),
        detail: L(
          "Si le contrat touche la location de main-d'œuvre, le permis d'agence est requis.",
          "If the contract involves staff leasing, the agency permit is required.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Contrat de dotation sans permis : risque CNESST. Vérifiez avant de soumissionner.",
        "Staffing contract without permit: CNESST risk. Verify before bidding.",
      ),
    ],
  },
  {
    slug: "registraire",
    name: "Registraire (NEQ)",
    category: "register",
    purpose: L(
      "Registre des entreprises du Québec : numéro d'entreprise du Québec (NEQ) et statut légal.",
      "Quebec enterprise register: Quebec enterprise number (NEQ) and legal status.",
    ),
    whenNeeded: L(
      "Pour confirmer le NEQ et le statut de l'entreprise avant toute soumission.",
      "To confirm the NEQ and the business status before any submission.",
    ),
    accountRequired: L("Recherche publique sans compte.", "Public search without an account."),
    produces: L("NEQ, statut d'enregistrement, adresse légale.", "NEQ, registration status, legal address."),
    href: "https://www.registreentreprises.gouv.qc.ca",
    steps: [
      {
        title: L("Vérifier le NEQ", "Verify the NEQ"),
        detail: L(
          "Confirmez que le statut est actif et les données à jour.",
          "Confirm the status is active and the data is current.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Statut radié : régularisez avant de soumissionner.",
        "Deregistered status: regularize before bidding.",
      ),
    ],
  },
  {
    slug: "oqlf",
    name: "OQLF",
    category: "compliance",
    purpose: L(
      "Office québécois de la langue française : obligations de francisation.",
      "Office québécois de la langue française: francization obligations.",
    ),
    whenNeeded: L(
      "Pour les entreprises de 50 employés et plus, ou selon les exigences du marché.",
      "For businesses of 50+ employees, or per the tender's requirements.",
    ),
    accountRequired: L("Portail OQLF via clicSÉQUR.", "OQLF portal via clicSÉQUR."),
    produces: L("Statut de francisation, attestations.", "Francization status, attestations."),
    href: "https://www.quebec.ca/gouvernement/organismes/oqlf",
    steps: [
      {
        title: L("Vérifier le statut", "Verify status"),
        detail: L(
          "Déterminez si votre entreprise est assujettie et obtenez l'attestation.",
          "Determine whether your business is subject and obtain the attestation.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Non applicable pour certaines petites entreprises ; confirmez le seuil.",
        "Not applicable to some small businesses; confirm the threshold.",
      ),
    ],
  },
  {
    slug: "donnees-quebec",
    name: "Données Québec",
    category: "data",
    purpose: L(
      "Portail de données ouvertes du Québec : permis, appels d'offres, zonage, et plus (licence ouverte).",
      "Quebec open data portal: permits, tenders, zoning, and more (open licence).",
    ),
    whenNeeded: L(
      "Source officielle de ZONNING pour les données publiques indexées automatiquement.",
      "ZONNING's official source for the public data it indexes automatically.",
    ),
    accountRequired: L("Accès public via API CKAN.", "Public access via the CKAN API."),
    produces: L(
      "Jeux de données ouverts (permis, marchés, zonage, contamination, patrimoine...).",
      "Open datasets (permits, contracts, zoning, contamination, heritage...).",
    ),
    href: "https://www.donneesquebec.ca",
    steps: [
      {
        title: L("Explorer le catalogue", "Browse the catalog"),
        detail: L(
          "Recherchez par thème ou municipalité. Les données sont sous licence ouverte.",
          "Search by theme or municipality. Data is under an open licence.",
        ),
      },
    ],
    commonProblems: [
      L(
        "Certains jeux sont mis à jour lentement ; ZONNING indique la fraîcheur réelle.",
        "Some datasets update slowly; ZONNING shows real freshness.",
      ),
    ],
  },
  {
    slug: "municipal-portals",
    name: "Portails municipaux",
    category: "municipal",
    purpose: L(
      "Permis de construction et zonage des municipalités québécoises.",
      "Construction permits and zoning for Quebec municipalities.",
    ),
    whenNeeded: L(
      "Pour les permis et règlements de zonage au niveau local.",
      "For permits and zoning bylaws at the local level.",
    ),
    accountRequired: L(
      "Variable selon la ville ; souvent un compte citoyen local.",
      "Varies by city; often a local citizen account.",
    ),
    produces: L("Permis, certificats, règlements de zonage (PDF).", "Permits, certificates, zoning bylaws (PDF)."),
    href: "https://www.donneesquebec.ca",
    steps: [
      {
        title: L("Trouver le bon portail", "Find the right portal"),
        detail: L(
          "ZONNING indique la couverture par municipalité sur la page Couverture.",
          "ZONNING shows per-municipality coverage on the Coverage page.",
        ),
      },
    ],
    commonProblems: [
      L(
        "De nombreuses villes publient en PDF/HTML uniquement ; ZONNING indexe ce qui est disponible en machine-readable.",
        "Many cities publish PDF/HTML only; ZONNING indexes what is machine-readable.",
      ),
    ],
  },
];

export function localize(value: Localized, locale: Locale): string {
  return locale === "fr" ? value.fr : value.en;
}

export function findGuide(slug: string): GovernmentSiteGuide | undefined {
  return GOVERNMENT_SITE_GUIDES.find((g) => g.slug === slug);
}

export const GUIDE_CATEGORIES: { id: GovernmentSiteGuide["category"]; fr: string; en: string }[] = [
  { id: "procurement", fr: "Approvisionnement", en: "Procurement" },
  { id: "licensing", fr: "Licences", en: "Licensing" },
  { id: "compliance", fr: "Conformité", en: "Compliance" },
  { id: "register", fr: "Registres", en: "Registers" },
  { id: "data", fr: "Données", en: "Data" },
  { id: "municipal", fr: "Municipal", en: "Municipal" },
];
