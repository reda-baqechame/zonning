import { addDays, differenceInCalendarDays, subDays } from "date-fns";
import type { OpportunityDossier } from "@/lib/domain/quebec";
import type { LeadSignal } from "@/lib/lead-signals";
import type { PermitDataQuality } from "@/lib/permits/quality";
import type { ValueEstimate } from "@/lib/permits/value-estimate";
import type { ContactLeads } from "@/lib/opportunities/contact-resolver";
import type { ParcelVerdict } from "@/lib/compliance/parcel-verdict";
import type { PipelineScoreResult, RankingReason } from "@/lib/pipeline-score";
import type { PropertyIntelligence } from "@/lib/intelligence";
import type { TenderScoreResult } from "@/lib/tender-score";

const TOP_LEAD_MIN_SCORE = 80;
const TOP_LEAD_MIN_CONFIDENCE = 65;
const HIGH_CONFIDENCE_MIN = 75;

type PermitRecord = {
  id: string;
  permitType: string;
  workType?: string | null;
  address: string;
  borough?: string | null;
  city?: string | null;
  estimatedCost?: number | null;
  issueDate?: Date | null;
  applicantName?: string | null;
  sourceUrl: string;
  sourceFetchedAt?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
};

type TenderRecord = {
  id: string;
  title: string;
  organization?: string | null;
  category?: string | null;
  region?: string | null;
  estimatedValue?: number | null;
  publishedAt?: Date | null;
  closesAt?: Date | null;
  requiresAmp?: boolean;
  sourceUrl: string;
  unspsc?: string | null;
  status?: string | null;
  amendmentCount?: number | null;
};

type PermitDossierInput = {
  permit: PermitRecord;
  score: number;
  signals: LeadSignal[];
  pipeline: PipelineScoreResult;
  dataQuality?: PermitDataQuality;
  intelligence?: PropertyIntelligence | null;
  locale?: "fr" | "en";
  valueEstimate?: ValueEstimate;
  contactLeads?: ContactLeads;
  parcelVerdict?: ParcelVerdict;
};

type TenderDossierInput = {
  tender: TenderRecord;
  score: number;
  signals: LeadSignal[];
  ranking: TenderScoreResult;
  hasSimilarAwards?: boolean;
  locale?: "fr" | "en";
  valueEstimate?: ValueEstimate;
  contactLeads?: ContactLeads;
};

type DossierLocale = "fr" | "en";

function copy(locale: DossierLocale, fr: string, en: string): string {
  return locale === "fr" ? fr : en;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceLevel(confidence: number): OpportunityDossier["confidenceLevel"] {
  if (confidence >= HIGH_CONFIDENCE_MIN) return "high";
  if (confidence >= 55) return "medium";
  return "low";
}

function freshness(date: Date | string | null | undefined, refreshedAt?: Date | string | null): OpportunityDossier["freshness"] {
  const observedAt = date ? new Date(date) : null;
  const days = observedAt && !Number.isNaN(observedAt.getTime())
    ? differenceInCalendarDays(new Date(), observedAt)
    : null;
  return {
    label:
      days == null
        ? "unknown"
        : days <= 1
          ? "today"
          : days <= 7
            ? "this_week"
            : days <= 90
              ? "recent"
              : "stale",
    observedAt: observedAt && !Number.isNaN(observedAt.getTime()) ? observedAt.toISOString() : null,
    refreshedAt: refreshedAt ? new Date(refreshedAt).toISOString() : null,
  };
}

function reasonText(reason: RankingReason, locale: DossierLocale): string {
  const text: Record<RankingReason["id"], [string, string]> = {
    verified_rbq_match: ["Le profil RBQ vérifié correspond à la portée des travaux.", "Verified RBQ profile matches the work scope."],
    rbq_mismatch: ["La classe RBQ doit être vérifiée avant toute démarche.", "RBQ class fit needs review before outreach."],
    cost_in_range: ["La valeur déclarée entre dans votre plage de projets.", "Declared value fits the configured project range."],
    cost_outside_range: ["La valeur déclarée est hors de votre plage de projets.", "Declared value is outside the configured project range."],
    fresh_record: ["Le dossier public est assez récent pour agir rapidement.", "The public record is recent enough for fast action."],
    stale_record: ["Le dossier public est ancien et doit être confirmé.", "The public record is older and should be confirmed."],
    active_market: ["Des activités similaires indiquent un marché local actif.", "Similar activity indicates a live local market."],
    site_upside: ["Les données de site indexées indiquent un potentiel à vérifier.", "Indexed site intelligence suggests possible upside."],
    site_constraints: ["Des contraintes de site indexées peuvent affecter la faisabilité.", "Indexed site constraints may affect feasibility."],
    trade_match: ["Le libellé du contrat correspond aux métiers configurés.", "Tender language matches the configured trades."],
    trade_mismatch: ["Le libellé du contrat correspond peu aux métiers configurés.", "Tender language is weak against the configured trades."],
    region_match: ["La région correspond au profil de l'entreprise.", "The region matches the contractor profile."],
    amp_blocked: ["Une autorisation AMP peut être requise avant de soumissionner.", "AMP authorization may be required before bidding."],
    bid_window: ["La fenêtre de soumission permet encore une analyse.", "The bid window is still workable."],
    limited_evidence: ["Le classement est limité par des preuves manquantes.", "The ranking is limited by missing evidence."],
  };
  return copy(locale, text[reason.id][0], text[reason.id][1]);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

type TenderSourceProfile = {
  kind: "seao" | "canadabuys" | "other";
  sourceLabel: string;
  officialSourceName: string;
  openNoticeLabel: string;
  addendaLabel: string;
  addendaDocumentLabel: string;
  officialSiteAction: string;
};

function tenderSourceProfile(tender: TenderRecord, locale: DossierLocale): TenderSourceProfile {
  const source = tender.sourceUrl.toLowerCase();
  const isCanadaBuys =
    source.includes("open.canada.ca") ||
    source.includes("canadabuys") ||
    source.includes("achatsetventes");
  const isSeao =
    source.includes("seao") ||
    source.includes("donneesquebec.ca/recherche/dataset/systeme-electronique-dappel-doffres-seao");

  if (isCanadaBuys) {
    return {
      kind: "canadabuys",
      sourceLabel: copy(locale, "Avis CanadaBuys (données ouvertes fédérales)", "CanadaBuys notice (federal open data)"),
      officialSourceName: "CanadaBuys",
      openNoticeLabel: copy(locale, "Ouvrir l'avis CanadaBuys", "Open the CanadaBuys notice"),
      addendaLabel: copy(locale, "Vérifier échéance et modifications", "Check deadline and amendments"),
      addendaDocumentLabel: copy(locale, "Registre des modifications ou avis CanadaBuys.", "CanadaBuys amendment/change notice log."),
      officialSiteAction: copy(
        locale,
        "Ouvrir CanadaBuys ou la source fédérale, vérifier l'avis, les modifications et les exigences obligatoires avant de télécharger les documents et avant d'assigner l'estimation.",
        "Open CanadaBuys or the federal source, verify the notice, amendments, and mandatory requirements before downloading documents and before assigning estimating time.",
      ),
    };
  }

  if (isSeao) {
    return {
      kind: "seao",
      sourceLabel: copy(locale, "Avis public SEAO", "SEAO public tender notice"),
      officialSourceName: "SEAO",
      openNoticeLabel: copy(locale, "Ouvrir l'avis SEAO", "Open the SEAO notice"),
      addendaLabel: copy(locale, "Vérifier échéance et addendas", "Check deadline and addenda"),
      addendaDocumentLabel: copy(locale, "Registre des addendas/avis modificateurs SEAO.", "SEAO addenda/amendment log."),
      officialSiteAction: copy(
        locale,
        "Ouvrir SEAO, vérifier l'avis, les addendas et les exigences obligatoires avant d'acheter ou télécharger les documents et avant d'assigner l'estimation.",
        "Open SEAO, verify the notice, addenda, and mandatory requirements before buying/downloading documents and before assigning estimating time.",
      ),
    };
  }

  return {
    kind: "other",
    sourceLabel: copy(locale, "Avis public d'approvisionnement", "Public procurement notice"),
    officialSourceName: copy(locale, "la source officielle", "the official source"),
    openNoticeLabel: copy(locale, "Ouvrir l'avis officiel", "Open the official notice"),
    addendaLabel: copy(locale, "Vérifier échéance et modifications", "Check deadline and amendments"),
    addendaDocumentLabel: copy(locale, "Registre des addendas ou modifications de la source officielle.", "Official-source addenda or amendment log."),
    officialSiteAction: copy(
      locale,
      "Ouvrir la source officielle, vérifier l'avis, les modifications et les exigences obligatoires avant de télécharger les documents et avant d'assigner l'estimation.",
      "Open the official source, verify the notice, amendments, and mandatory requirements before downloading documents and before assigning estimating time.",
    ),
  };
}

function evidenceGapText(id: string, locale: DossierLocale): string {
  const text: Record<string, [string, string]> = {
    rbq_profile: [
      "Le profil et les sous-catégories de licence RBQ doivent être configurés.",
      "The RBQ licence profile and subclasses must be configured.",
    ],
    cost_or_budget: [
      "La valeur des travaux ou la plage de budget de l'entreprise doit être confirmée.",
      "The work value or the company's budget range must be confirmed.",
    ],
    market_activity: [
      "L'activité comparable du marché local n'est pas suffisamment documentée.",
      "Comparable local market activity is not sufficiently documented.",
    ],
    issue_date: [
      "La date d'émission du permis doit être confirmée.",
      "The permit issue date must be confirmed.",
    ],
    site_intelligence: [
      "Les données de site disponibles ne suffisent pas pour évaluer la faisabilité.",
      "Available site data is insufficient to assess feasibility.",
    ],
    zoning: [
      "La zone, le règlement applicable et les usages permis à la parcelle doivent être vérifiés.",
      "The parcel zone, applicable bylaw, and permitted uses must be verified.",
    ],
    trade_profile: [
      "Les métiers cibles de l'entreprise doivent être configurés pour mesurer l'adéquation.",
      "The company's target trades must be configured to measure fit.",
    ],
    region_profile: [
      "Les régions desservies par l'entreprise doivent être configurées.",
      "The company's service regions must be configured.",
    ],
    value_or_budget: [
      "La valeur du contrat ou la plage de budget de l'entreprise doit être confirmée.",
      "The contract value or the company's budget range must be confirmed.",
    ],
    amp_requirement: [
      "L'exigence et le statut d'autorisation AMP doivent être vérifiés.",
      "The AMP requirement and authorization status must be verified.",
    ],
    closing_date: [
      "La date et l'heure limites de dépôt doivent être confirmées dans SEAO.",
      "The bid closing date and time must be confirmed in SEAO.",
    ],
  };
  const value = text[id];
  return value
    ? copy(locale, value[0], value[1])
    : copy(locale, "Une preuve requise pour la décision reste à confirmer.", "Evidence required for the decision remains unconfirmed.");
}

function permitQualityIssueText(id: string, locale: DossierLocale): string {
  const text: Record<string, [string, string]> = {
    invalid_source: ["Le lien source officiel est absent ou invalide.", "The official source link is missing or invalid."],
    missing_source_id: ["L'identifiant municipal du permis n'est pas publié.", "The municipal permit identifier is not published."],
    derived_identity: ["L'identifiant stable a été reconstruit à partir du dossier public.", "The stable identifier was reconstructed from the public record."],
    missing_address: ["L'adresse civique n'est pas publiée.", "The civic address is not published."],
    placeholder_address: ["L'adresse publiée n'identifie pas un emplacement précis.", "The published address does not identify a precise location."],
    missing_permit_type: ["Le type de permis n'est pas publié.", "The permit type is not published."],
    generic_permit_type: ["Le type de permis publié est trop général pour qualifier les travaux.", "The published permit type is too general to qualify the work."],
    missing_issue_date: ["La date d'émission du permis n'est pas publiée.", "The permit issue date is not published."],
    future_issue_date: ["La date d'émission publiée est future et doit être vérifiée.", "The published issue date is in the future and must be verified."],
    stale_record: ["Le permis date de plus de deux ans et peut ne plus représenter une occasion active.", "The permit is more than two years old and may no longer represent an active opportunity."],
    missing_cost: ["La valeur déclarée des travaux n'est pas publiée.", "The declared work value is not published."],
    missing_coordinates: ["Les coordonnées ne sont pas publiées; la localisation cartographique reste approximative.", "Coordinates are not published; map positioning remains approximate."],
    dataset_level_source: ["La source ouvre le jeu de données municipal, pas le permis individuel.", "The source opens the municipal dataset, not the individual permit."],
  };
  const value = text[id];
  return value
    ? copy(locale, value[0], value[1])
    : copy(locale, "Un champ du dossier municipal doit être confirmé à la source.", "A municipal record field must be confirmed at the source.");
}

function evidenceThresholds(input: {
  score: number;
  confidence: number;
  missingEvidence: string[];
  hardLimitations: string[];
}) {
  const missing = unique([...input.missingEvidence, ...input.hardLimitations]);
  return {
    canCallTopLead:
      input.score >= TOP_LEAD_MIN_SCORE &&
      input.confidence >= TOP_LEAD_MIN_CONFIDENCE &&
      missing.length <= 3,
    canCallHighConfidence:
      input.confidence >= HIGH_CONFIDENCE_MIN && missing.length <= 2,
    minimumConfidence: TOP_LEAD_MIN_CONFIDENCE,
    missingEvidence: missing,
  };
}

type TriageRecommendation = OpportunityDossier["triage"]["recommendation"];
type GovernmentMission = NonNullable<OpportunityDossier["governmentMission"]>;

function missionVerdict(recommendation: TriageRecommendation): GovernmentMission["verdict"] {
  if (recommendation === "act_now") return "pursue";
  if (recommendation === "verify_first") return "verify_before_spend";
  if (recommendation === "watch") return "watch";
  return "skip";
}

function tenderDeadline(
  closesAt: Date | null | undefined,
  locale: DossierLocale,
): Pick<GovernmentMission, "deadlineRisk" | "deadlineLabel"> {
  if (!closesAt) {
    return {
      deadlineRisk: "unknown",
      deadlineLabel: copy(locale, "Date limite non publiée : confirmer l'heure exacte dans SEAO.", "Deadline not published: confirm the exact time in SEAO."),
    };
  }

  const days = differenceInCalendarDays(closesAt, new Date());
  if (days < 0) {
    return {
      deadlineRisk: "missed",
      deadlineLabel: copy(locale, "La date limite publiée est passée.", "The published deadline has passed."),
    };
  }
  if (days <= 2) {
    return {
      deadlineRisk: "urgent",
      deadlineLabel: copy(locale, "Échéance sous 48 heures : soumettre seulement si le dossier est déjà prêt.", "Deadline inside 48 hours: submit only if the file is already ready."),
    };
  }
  if (days <= 7) {
    return {
      deadlineRisk: "soon",
      deadlineLabel: copy(locale, `Échéance dans ${days} jour${days > 1 ? "s" : ""}.`, `Deadline in ${days} day${days > 1 ? "s" : ""}.`),
    };
  }

  return {
    deadlineRisk: "none",
    deadlineLabel: copy(locale, `Échéance dans ${days} jours.`, `Deadline in ${days} days.`),
  };
}

function permitDeadline(locale: DossierLocale): Pick<GovernmentMission, "deadlineRisk" | "deadlineLabel"> {
  return {
    deadlineRisk: "none",
    deadlineLabel: copy(locale, "Aucune échéance de soumission publiée pour ce permis.", "No submission deadline is published for this permit."),
  };
}

function readinessGapText(id: string, locale: DossierLocale): string {
  const text: Record<string, [string, string]> = {
    rbq_profile: ["Sous-catégories RBQ prêtes à comparer avec les travaux.", "RBQ subclasses ready to compare with the work."],
    cost_or_budget: ["Plage de budget/projet cible de votre entreprise.", "Your company's target project budget range."],
    market_activity: ["Preuve que ce marché local vaut un suivi commercial.", "Proof this local market is worth sales follow-up."],
    issue_date: ["Date officielle d'émission du permis.", "Official permit issue date."],
    site_intelligence: ["Contraintes du site et potentiel vérifiés.", "Verified site constraints and upside."],
    zoning: ["Zonage, usage permis et règlement municipal vérifiés.", "Verified zoning, permitted use, and municipal bylaw."],
    trade_profile: ["Métiers que votre entreprise veut réellement soumissionner.", "Trades your company actually wants to bid."],
    region_profile: ["Territoires desservis par votre équipe.", "Regions served by your team."],
    value_or_budget: ["Taille de contrat que votre entreprise accepte.", "Contract size your company accepts."],
    amp_requirement: ["Statut d'autorisation AMP de votre entreprise.", "Your company's AMP authorization status."],
    amp_review_required: ["Confirmation AMP avant toute soumission.", "AMP confirmation before any bid."],
    closing_date: ["Date et heure exactes de dépôt dans SEAO.", "Exact SEAO submission date and time."],
    permit_record_not_usable: ["Dossier municipal officiel assez complet pour agir.", "Municipal record complete enough to act on."],
  };
  const value = text[id];
  return value
    ? copy(locale, value[0], value[1])
    : copy(locale, "Preuve de préparation encore manquante.", "Readiness proof is still missing.");
}

function buildPermitGovernmentMission(input: {
  permit: PermitRecord;
  recommendation: TriageRecommendation;
  thresholds: ReturnType<typeof evidenceThresholds>;
  dataQuality?: PermitDataQuality;
  locale: DossierLocale;
}): GovernmentMission {
  const { permit, recommendation, thresholds, dataQuality, locale } = input;
  const deadline = permitDeadline(locale);
  const missingReadiness = unique([
    ...thresholds.missingEvidence.map((item) => readinessGapText(item, locale)),
    !permit.applicantName ? copy(locale, "Nom du demandeur/contact publié.", "Published applicant/contact name.") : "",
    dataQuality?.sourceScope !== "record" ? copy(locale, "Lien vers le dossier municipal exact, pas seulement le jeu de données.", "Link to the exact municipal record, not only the dataset.") : "",
  ]);
  const hasExactRecord = dataQuality?.sourceScope === "record";
  const hasApplicant = Boolean(permit.applicantName);

  return {
    verdict: missionVerdict(recommendation),
    worthBuyingDocuments: false,
    ...deadline,
    officialSiteAction: copy(
      locale,
      "Ouvrir la source municipale, confirmer la portée des travaux et le demandeur, puis décider si un suivi conforme vaut la peine.",
      "Open the municipal source, confirm work scope and applicant, then decide whether compliant follow-up is worth it.",
    ),
    requiredDocuments: unique([
      copy(locale, "Dossier officiel du permis municipal.", "Official municipal permit record."),
      copy(locale, "Vérification de la licence et sous-catégorie RBQ.", "RBQ licence and subclass check."),
      copy(locale, "Vérification zonage/règlement si le site influence la faisabilité.", "Zoning/bylaw check if the site affects feasibility."),
      permit.applicantName
        ? copy(locale, "Certificat de source publique LCAP/CASL avant prospection.", "CASL public-source certificate before outreach.")
        : "",
    ]),
    missingReadiness,
    rejectionRisks: unique([
      copy(locale, "Mauvaise sous-catégorie RBQ pour les travaux publiés.", "Wrong RBQ subclass for the published work."),
      copy(locale, "Permis trop ancien, incomplet ou seulement disponible au niveau jeu de données.", "Permit too stale, incomplete, or only available at dataset level."),
      copy(locale, "Prospection sans preuve de source publique et base LCAP/CASL.", "Outreach without public-source and CASL basis proof."),
      copy(locale, "Zonage ou contraintes du site non confirmés avant d'évaluer l'occasion.", "Zoning or site constraints not confirmed before evaluating the opportunity."),
    ]),
    taskBoard: [
      {
        id: "open-municipal-source",
        title: copy(locale, "Ouvrir la source municipale", "Open the municipal source"),
        detail: copy(locale, "Confirmer que le permis, l'adresse, la date et la portée correspondent au dossier affiché.", "Confirm the permit, address, date, and scope match the displayed record."),
        status: hasExactRecord ? "todo" : "verify",
        deadlineLabel: deadline.deadlineLabel,
        buttonLabel: copy(locale, "Ouvrir la source", "Open source"),
        href: permit.sourceUrl,
      },
      {
        id: "verify-rbq-class",
        title: copy(locale, "Vérifier la classe RBQ", "Verify RBQ class"),
        detail: copy(locale, "Comparer la sous-catégorie RBQ de votre profil avec la portée des travaux publiés.", "Compare your RBQ subclass with the published work scope."),
        status: thresholds.missingEvidence.includes("rbq_profile") ? "blocked" : "verify",
        buttonLabel: copy(locale, "Vérifier RBQ", "Check RBQ"),
        href: "/settings",
      },
      {
        id: "check-zoning",
        title: copy(locale, "Confirmer zonage et contraintes", "Confirm zoning and constraints"),
        detail: copy(locale, "Vérifier l'usage, les contraintes patrimoniales/contaminées et les règles municipales avant d'évaluer le site.", "Verify use, heritage/contamination constraints, and municipal rules before evaluating the site."),
        status: thresholds.missingEvidence.includes("zoning") ? "blocked" : "verify",
        buttonLabel: copy(locale, "Ouvrir l'intelligence", "Open intelligence"),
        href: "/intelligence",
      },
      {
        id: "casl-proof",
        title: copy(locale, "Préparer la preuve LCAP/CASL", "Prepare CASL proof"),
        detail: copy(locale, "Ne pas prospecter avant d'avoir conservé la source publique et le contexte du contact.", "Do not prospect before saving the public source and contact context."),
        status: hasApplicant ? "todo" : "blocked",
        buttonLabel: copy(locale, "Créer la preuve", "Create proof"),
        href: "/compliance",
      },
    ],
    nextButtons: [
      {
        kind: "official_source",
        label: copy(locale, "Ouvrir la source officielle", "Open official source"),
        href: permit.sourceUrl,
      },
      {
        kind: "pipeline",
        label: copy(locale, "Ajouter au pipeline", "Add to pipeline"),
      },
      {
        kind: "readiness",
        label: copy(locale, "Vérifier la préparation", "Check readiness"),
      },
    ],
  };
}

function buildTenderGovernmentMission(input: {
  tender: TenderRecord;
  recommendation: TriageRecommendation;
  thresholds: ReturnType<typeof evidenceThresholds>;
  ranking: TenderScoreResult;
  sourceProfile: TenderSourceProfile;
  locale: DossierLocale;
}): GovernmentMission {
  const { tender, recommendation, thresholds, ranking, sourceProfile, locale } = input;
  const deadline = tenderDeadline(tender.closesAt, locale);
  const deadlineBlocksBuying = deadline.deadlineRisk === "urgent" || deadline.deadlineRisk === "missed" || deadline.deadlineRisk === "unknown";
  const missingReadiness = unique([
    ...thresholds.missingEvidence.map((item) =>
      item === "closing_date"
        ? copy(locale, `Date et heure exactes de dépôt dans ${sourceProfile.officialSourceName}.`, `Exact ${sourceProfile.officialSourceName} submission date and time.`)
        : readinessGapText(item, locale),
    ),
    tender.requiresAmp ? readinessGapText("amp_review_required", locale) : "",
    !tender.organization ? copy(locale, "Organisme acheteur confirmé.", "Confirmed buyer organization.") : "",
  ]);
  const ampBlocked = Boolean(tender.requiresAmp);
  const deadlineStatus: GovernmentMission["taskBoard"][number]["status"] =
    deadline.deadlineRisk === "missed" || deadline.deadlineRisk === "urgent"
      ? "blocked"
      : deadline.deadlineRisk === "unknown"
        ? "verify"
        : "todo";

  return {
    verdict: missionVerdict(recommendation),
    worthBuyingDocuments:
      !deadlineBlocksBuying &&
      (recommendation === "act_now" || (recommendation === "verify_first" && ranking.confidence >= 55)),
    ...deadline,
    officialSiteAction: sourceProfile.officialSiteAction,
    requiredDocuments: unique([
      copy(locale, "Documents officiels de l'appel d'offres et devis.", "Official tender documents and specifications."),
      sourceProfile.addendaDocumentLabel,
      copy(locale, "Formulaire de soumission et bordereau de prix.", "Bid form and pricing sheet."),
      copy(locale, "Attestation Revenu Québec.", "Revenu Québec attestation."),
      copy(locale, "Déclaration de lobbyisme ou non-collusion si exigée.", "Lobbying or non-collusion declaration if required."),
      tender.requiresAmp ? copy(locale, "Autorisation AMP valide à la date de dépôt.", "Valid AMP authorization at submission date.") : "",
      copy(locale, "Clauses assurances, cautionnements, CNESST, OQLF et RBQ à vérifier.", "Insurance, bonding, CNESST, OQLF, and RBQ clauses to verify."),
    ]),
    missingReadiness,
    rejectionRisks: unique([
      copy(locale, "Addenda non lus ou signés avant le dépôt.", "Unread or unsigned addenda before submission."),
      copy(locale, "Attestation Revenu Québec absente ou expirée.", "Missing or expired Revenu Québec attestation."),
      tender.requiresAmp ? copy(locale, "Autorisation AMP absente au moment de soumissionner.", "AMP authorization missing when bidding.") : "",
      copy(locale, "Mauvaise méthode, heure ou lieu de dépôt.", "Wrong submission method, time, or place."),
      copy(locale, "Cautionnement, assurance, CNESST, OQLF ou licence RBQ non conforme.", "Bonding, insurance, CNESST, OQLF, or RBQ licence non-compliant."),
    ]),
    taskBoard: [
      {
        id: sourceProfile.kind === "seao" ? "open-seao" : "open-official-notice",
        title: sourceProfile.openNoticeLabel,
        detail: copy(locale, "Confirmer l'acheteur, le numéro d'avis, les dates, la catégorie et la méthode de dépôt.", "Confirm buyer, notice number, dates, category, and submission method."),
        status: "todo",
        deadlineLabel: deadline.deadlineLabel,
        buttonLabel: sourceProfile.kind === "seao" ? copy(locale, "Ouvrir SEAO", "Open SEAO") : copy(locale, "Ouvrir la source", "Open source"),
        href: tender.sourceUrl,
      },
      {
        id: "deadline-addenda",
        title: sourceProfile.addendaLabel,
        detail: copy(locale, "Relire les addendas ou modifications publiés avant toute décision de prix ou dépôt.", "Review published addenda or amendments before any pricing or submission decision."),
        status: deadlineStatus,
        deadlineLabel: deadline.deadlineLabel,
        buttonLabel: copy(locale, "Voir les modifications", "View changes"),
        href: tender.sourceUrl,
      },
      {
        id: "amp-threshold",
        title: copy(locale, "Valider AMP avant de payer", "Validate AMP before spending"),
        detail: copy(locale, "Pour les seuils applicables, l'autorisation doit être détenue à la date de dépôt de la soumission.", "For applicable thresholds, authorization must be held on the bid submission date."),
        status: ampBlocked ? "blocked" : "ready",
        buttonLabel: copy(locale, "Vérifier AMP", "Check AMP"),
        href: "https://www.amp.quebec/en/autorisation-de-contracter",
      },
      {
        id: "revenue-quebec",
        title: copy(locale, "Obtenir l'attestation Revenu Québec", "Get the Revenu Québec attestation"),
        detail: copy(locale, "Confirmer que l'attestation sera valide pour la soumission et les exigences du dossier.", "Confirm the attestation will be valid for the bid and file requirements."),
        status: "verify",
        buttonLabel: copy(locale, "Préparer l'attestation", "Prepare attestation"),
        href: "/settings",
      },
      {
        id: "lobbyism-declaration",
        title: copy(locale, "Préparer la déclaration obligatoire", "Prepare the mandatory declaration"),
        detail: copy(locale, "Identifier les formulaires obligatoires, signatures, non-collusion/lobbyisme et causes de rejet automatique.", "Identify mandatory forms, signatures, non-collusion/lobbying, and automatic rejection clauses."),
        status: "verify",
        buttonLabel: copy(locale, "Lister les formulaires", "List forms"),
      },
      {
        id: "price-submit",
        title: copy(locale, "Préparer prix et dépôt", "Prepare price and submission"),
        detail: copy(locale, "Assembler le bordereau, assurances/cautionnements et méthode de dépôt avant la date limite.", "Assemble pricing sheet, insurance/bonds, and submission method before the deadline."),
        status: deadlineStatus,
        deadlineLabel: deadline.deadlineLabel,
        buttonLabel: copy(locale, "Ajouter au pipeline", "Add to pipeline"),
      },
    ],
    nextButtons: [
      {
        kind: "official_source",
        label: sourceProfile.kind === "seao" ? copy(locale, "Ouvrir SEAO", "Open SEAO") : copy(locale, "Ouvrir la source", "Open source"),
        href: tender.sourceUrl,
      },
      {
        kind: "document_check",
        label: copy(locale, "Vérifier les documents", "Check documents"),
      },
      {
        kind: "pipeline",
        label: copy(locale, "Ajouter au pipeline", "Add to pipeline"),
      },
      {
        kind: "readiness",
        label: copy(locale, "Vérifier la préparation", "Check readiness"),
      },
    ],
  };
}

function siteIntelligenceSummary(intelligence: PropertyIntelligence | null | undefined, locale: DossierLocale): OpportunityDossier["siteIntelligence"] | undefined {
  if (!intelligence) return undefined;
  const confirmedFacts: string[] = [];
  const inferredContext: string[] = [];
  const nearbyRisks: string[] = [];
  const unavailableEvidence: string[] = [];

  if (intelligence.assessment?.totalValue) confirmedFacts.push(copy(locale, "La valeur de l'évaluation foncière est indexée.", "Property assessment value is indexed."));
  else unavailableEvidence.push(copy(locale, "Aucune évaluation foncière appariée.", "No matched property assessment record."));
  if (intelligence.recentTransaction?.salePrice) confirmedFacts.push(copy(locale, "Une transaction récente est indexée.", "Recent transaction evidence is indexed."));
  if (intelligence.zoning?.determination === "confirmed" && intelligence.zoning.evidenceScope === "parcel") {
    confirmedFacts.push(copy(locale, "Une preuve de zonage à la parcelle est indexée.", "Parcel-level zoning evidence is indexed."));
  } else if (intelligence.zoning) {
    inferredContext.push(copy(locale, "Le signal de zonage est contextuel ou de niveau planification.", "Zoning signal is contextual or planning-level only."));
  } else {
    unavailableEvidence.push(copy(locale, "Aucune preuve réglementaire de zonage à la parcelle.", "No parcel zoning bylaw evidence indexed."));
  }
  if (intelligence.developmentProjects?.nearby) inferredContext.push(copy(locale, "Une activité de développement à proximité est indexée.", "Nearby development activity is indexed."));
  if (intelligence.marketHeat) inferredContext.push(copy(locale, "Un signal d'activité du marché local est indexé.", "Local market heat signal is indexed."));
  if (intelligence.contamination?.gtcNearby || intelligence.contamination?.nearby) nearbyRisks.push(copy(locale, "Signal de terrain contaminé à proximité.", "Nearby contaminated-land signal."));
  if (intelligence.heritage?.lpcProtected || intelligence.heritage?.hasEip || intelligence.heritage?.nearby) nearbyRisks.push(copy(locale, "Signal de contrainte patrimoniale.", "Heritage constraint signal."));
  if (intelligence.roadworks?.nearby) nearbyRisks.push(copy(locale, "Signal de travaux routiers à proximité.", "Nearby roadwork signal."));
  if (intelligence.rbqInfraction?.found) nearbyRisks.push(copy(locale, "Signal d'infraction RBQ.", "RBQ infraction signal."));
  if (intelligence.municipalInspection?.found) nearbyRisks.push(copy(locale, "Signal d'inspection municipale.", "Municipal inspection signal."));

  return { confirmedFacts, inferredContext, nearbyRisks, unavailableEvidence };
}

export function buildPermitOpportunityDossier(input: PermitDossierInput): OpportunityDossier {
  const { permit, pipeline, dataQuality, intelligence } = input;
  const locale = input.locale ?? "en";
  const limitations = unique([
    ...(dataQuality?.issues ?? []).map((issue) => permitQualityIssueText(issue, locale)),
    ...(pipeline.missingEvidence ?? []).map((item) => evidenceGapText(item, locale)),
    dataQuality && !dataQuality.officialSource ? copy(locale, "L'hôte de la source n'est pas reconnu comme officiel.", "Source host is not recognized as an official Quebec or municipal source.") : "",
    !permit.applicantName ? copy(locale, "Le demandeur ou contact n'est pas publié.", "Applicant/contact is not published in this record.") : "",
    copy(locale, "Vérifier la source municipale avant toute démarche, soumission ou action de conformité.", "Verify the municipal source before outreach, bidding, or compliance action."),
  ]);
  const thresholds = evidenceThresholds({
    score: input.score,
    confidence: pipeline.confidence,
    missingEvidence: pipeline.missingEvidence,
    hardLimitations: dataQuality?.usable === false ? ["permit_record_not_usable"] : [],
  });
  const whyRanked = unique([
    ...pipeline.reasons.map((reason) => reasonText(reason, locale)),
    input.signals.some((signal) => signal.id === "rbq_eligible") ? copy(locale, "Le signal d'adéquation RBQ est positif.", "RBQ fit signal is positive.") : "",
    input.signals.some((signal) => signal.id === "high_value") ? copy(locale, "La valeur déclarée dépasse le seuil de grande valeur.", "Declared value is above the high-value threshold.") : "",
    input.signals.some((signal) => signal.id === "density_upside") ? copy(locale, "L'intelligence de site indique un potentiel de densification à vérifier.", "Site intelligence suggests density upside.") : "",
    thresholds.canCallTopLead ? copy(locale, "Le seuil de preuve permet un traitement prioritaire.", "Evidence threshold passed for top-lead treatment.") : copy(locale, "Le seuil de preuve ne permet pas de qualifier ce dossier comme prioritaire.", "Evidence threshold not high enough for a top-lead claim."),
  ]);
  const recommendation = thresholds.canCallTopLead
    ? "act_now"
    : input.score >= 60 && pipeline.confidence >= 45
      ? "verify_first"
      : input.score >= 40
        ? "watch"
        : "deprioritize";
  const blockers = thresholds.missingEvidence.slice(0, 4);

  return {
    id: `permit:${permit.id}`,
    kind: "permit",
    title: permit.permitType,
    municipality: permit.city,
    addressOrRegion: [permit.address, permit.borough].filter(Boolean).join(" - "),
    score: clampScore(input.score),
    confidence: clampScore(pipeline.confidence),
    confidenceLevel: confidenceLevel(pipeline.confidence),
    signals: input.signals,
    whyRanked,
    nextAction: thresholds.canCallTopLead
      ? copy(locale, "Ouvrir la source municipale, confirmer la portée et le demandeur, puis préparer un suivi conforme.", "Open the municipal source, confirm scope and applicant, then create the compliant follow-up.")
      : copy(locale, "Résoudre les preuves manquantes avant de traiter ce dossier comme une occasion qualifiée.", "Resolve missing evidence before treating this as a qualified lead."),
    sourceUrl: permit.sourceUrl,
    sourceLabel: dataQuality?.sourceScope === "record" ? copy(locale, "Dossier municipal de permis", "Municipal permit record") : copy(locale, "Jeu de données municipal de permis", "Municipal permit dataset"),
    freshness: freshness(permit.issueDate, permit.sourceFetchedAt),
    limitations,
    evidenceThresholds: thresholds,
    triage: {
      recommendation,
      reason: recommendation === "act_now"
        ? copy(locale, "Bon ajustement et preuve suffisante : validez la source puis engagez le suivi.", "Strong fit with sufficient evidence: validate the source, then start follow-up.")
        : recommendation === "verify_first"
          ? copy(locale, "Le potentiel existe, mais une vérification ciblée doit précéder le temps de vente.", "Potential exists, but targeted verification should come before sales time.")
          : recommendation === "watch"
            ? copy(locale, "Conservez le signal sans y consacrer du temps aujourd'hui.", "Keep the signal without spending time on it today.")
            : copy(locale, "L'adéquation ou la preuve actuelle est trop faible pour prioriser ce dossier.", "Current fit or evidence is too weak to prioritize this record."),
      effort: blockers.length <= 1 ? "light" : blockers.length <= 3 ? "moderate" : "heavy",
      actionBy: addDays(new Date(), recommendation === "act_now" ? 2 : recommendation === "verify_first" ? 4 : 7).toISOString(),
      blockers,
      recommendedStage: recommendation === "act_now" ? "pursuing" : recommendation === "verify_first" ? "researching" : "new",
    },
    governmentMission: buildPermitGovernmentMission({
      permit,
      recommendation,
      thresholds,
      dataQuality,
      locale,
    }),
    siteIntelligence: siteIntelligenceSummary(intelligence, locale),
    pipelineBreakdown: pipeline.breakdown,
    complianceAction: {
      enabled: Boolean(permit.sourceUrl && permit.applicantName && dataQuality?.usable),
      label: copy(locale, "Créer le certificat de source publique LCAP", "Create CASL public-source certificate"),
      reason: permit.applicantName ? undefined : copy(locale, "Le demandeur ou contact n'est pas publié.", "Applicant/contact is not published."),
    },
    exportAction: {
      enabled: Boolean(dataQuality?.usable),
      fields: ["permitType", "address", "municipality", "score", "confidence", "sourceUrl", "nextAction"],
    },
    valueEstimate: input.valueEstimate,
    contactLeads: input.contactLeads,
    parcelVerdict: input.parcelVerdict,
  };
}

export function buildTenderOpportunityDossier(input: TenderDossierInput): OpportunityDossier {
  const { tender, ranking } = input;
  const locale = input.locale ?? "en";
  const sourceProfile = tenderSourceProfile(tender, locale);
  const limitations = unique([
    ...ranking.missingEvidence.map((item) =>
      item === "closing_date"
        ? copy(locale, `La date et l'heure limites de dépôt doivent être confirmées dans ${sourceProfile.officialSourceName}.`, `The bid closing date and time must be confirmed in ${sourceProfile.officialSourceName}.`)
        : evidenceGapText(item, locale),
    ),
    tender.requiresAmp ? copy(locale, "L'autorisation AMP doit être confirmée avant de soumissionner.", "AMP authorization must be confirmed before bidding.") : "",
    tender.amendmentCount ? copy(locale, `Un ou plusieurs addendas ou modifications doivent être révisés sur ${sourceProfile.officialSourceName}.`, `One or more addenda/amendments must be reviewed on ${sourceProfile.officialSourceName}.`) : "",
    !tender.organization ? copy(locale, "L'organisme acheteur n'est pas normalisé.", "Buyer organization is not normalized.") : "",
    !tender.closesAt ? copy(locale, "La date de clôture n'est pas publiée ou normalisée.", "Closing date is not published or not normalized.") : "",
    copy(locale, `Les documents officiels et modifications ${sourceProfile.officialSourceName} doivent être révisés avant une décision de soumission.`, `Official ${sourceProfile.officialSourceName} documents and amendments must be reviewed before a bid/no-bid decision.`),
  ]);
  const thresholds = evidenceThresholds({
    score: input.score,
    confidence: ranking.confidence,
    missingEvidence: ranking.missingEvidence,
    hardLimitations: tender.requiresAmp ? ["amp_review_required"] : [],
  });
  const whyRanked = unique([
    ...ranking.reasons.map((reason) => reasonText(reason, locale)),
    input.hasSimilarAwards ? copy(locale, "Un historique d'attributions similaires est indexé.", "Similar award history is indexed.") : "",
    input.signals.some((signal) => signal.id === "urgent_close") ? copy(locale, "La date de clôture exige une action rapide.", "Closing date requires near-term action.") : "",
    input.signals.some((signal) => signal.id === "thursday_seao") ? copy(locale, `Le contrat ferme dans la fenêtre de risque du jeudi ${sourceProfile.officialSourceName}.`, `Tender closes on the Thursday ${sourceProfile.officialSourceName} risk window.`) : "",
    thresholds.canCallTopLead ? copy(locale, "Le seuil de preuve permet un traitement prioritaire.", "Evidence threshold passed for top-lead treatment.") : copy(locale, "Le seuil de preuve ne permet pas de qualifier ce dossier comme prioritaire.", "Evidence threshold not high enough for a top-lead claim."),
  ]);
  const recommendation = thresholds.canCallTopLead
    ? "act_now"
    : input.score >= 60 && ranking.confidence >= 45
      ? "verify_first"
      : input.score >= 40
        ? "watch"
        : "deprioritize";
  const blockers = thresholds.missingEvidence.slice(0, 4);
  const suggestedActionBy = tender.closesAt
    ? subDays(tender.closesAt, 2)
    : addDays(new Date(), recommendation === "act_now" ? 1 : 3);
  const actionBy = suggestedActionBy.getTime() < Date.now()
    ? new Date()
    : suggestedActionBy;

  return {
    id: `tender:${tender.id}`,
    kind: "tender",
    title: tender.title,
    municipality: tender.region,
    addressOrRegion: tender.region ?? tender.organization ?? "Quebec",
    score: clampScore(input.score),
    confidence: clampScore(ranking.confidence),
    confidenceLevel: confidenceLevel(ranking.confidence),
    signals: input.signals,
    whyRanked,
    nextAction: thresholds.canCallTopLead
      ? copy(locale, `Réviser les documents et modifications ${sourceProfile.officialSourceName}, assigner un estimateur, puis décider de soumissionner ou non.`, `Review ${sourceProfile.officialSourceName} documents and amendments, assign an estimator, then decide bid/no-bid.`)
      : copy(locale, "Vérifier les preuves d'adéquation manquantes avant d'engager du temps d'estimation.", "Review missing fit evidence before committing estimating time."),
    sourceUrl: tender.sourceUrl,
    sourceLabel: sourceProfile.sourceLabel,
    freshness: freshness(tender.publishedAt, tender.publishedAt),
    limitations,
    evidenceThresholds: thresholds,
    triage: {
      recommendation,
      reason: recommendation === "act_now"
        ? copy(locale, "Le dossier justifie une revue de soumission immédiate, sous réserve des documents officiels.", "The record warrants immediate bid review, subject to the official documents.")
        : recommendation === "verify_first"
          ? copy(locale, "Validez l'adéquation et les exigences avant de mobiliser l'estimation.", "Validate fit and requirements before committing estimating capacity.")
          : recommendation === "watch"
            ? copy(locale, "Surveillez le dossier sans déplacer la capacité d'estimation aujourd'hui.", "Monitor the record without moving estimating capacity today.")
            : copy(locale, "L'adéquation ou la preuve actuelle ne justifie pas une revue prioritaire.", "Current fit or evidence does not justify priority review."),
      effort: blockers.length <= 1 ? "light" : blockers.length <= 3 ? "moderate" : "heavy",
      actionBy: actionBy.toISOString(),
      blockers,
      recommendedStage: recommendation === "act_now" ? "pursuing" : recommendation === "verify_first" ? "researching" : "new",
    },
    governmentMission: buildTenderGovernmentMission({
      tender,
      recommendation,
      thresholds,
      ranking,
      sourceProfile,
      locale,
    }),
    pipelineBreakdown: ranking.breakdown,
    complianceAction: {
      enabled: false,
      label: copy(locale, "Ce n'est pas une source de sollicitation LCAP", "Not a CASL outreach source"),
      reason: copy(locale, "Utiliser le processus d'approvisionnement SEAO, pas une sollicitation directe.", "Use SEAO procurement workflow, not direct marketing outreach."),
    },
    exportAction: {
      enabled: true,
      fields: ["title", "organization", "region", "score", "confidence", "sourceUrl", "nextAction"],
    },
    valueEstimate: input.valueEstimate,
    contactLeads: input.contactLeads,
  };
}
