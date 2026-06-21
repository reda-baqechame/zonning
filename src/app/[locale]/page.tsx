import { differenceInCalendarDays } from "date-fns";
import { redirect } from "next/navigation";
import PublicContractorDesk, {
  type PublicDeskOpportunity,
} from "@/components/PublicContractorDesk";
import { Link } from "@/i18n/navigation";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import QuebecAtlasMap from "@/components/QuebecAtlasMap";
import QuebecIntelligenceSearch from "@/components/QuebecIntelligenceSearch";
import { getSessionUser } from "@/lib/auth";
import { formatCad } from "@/lib/format-cad";
import { fetchMarketPulseStats } from "@/lib/market-pulse";
import { prisma } from "@/lib/prisma";
import { ArrowRight, BellRing, BrainCircuit, FileSearch, Network } from "lucide-react";

const COPY = {
  fr: {
    phaseEyebrow: "NOUVEAU EN PRODUCTION",
    phaseTitle: "Phase 3 est maintenant visible sur la page d'accueil.",
    phaseDescription:
      "Le graphe d'investigation, le score de risque, le rapport PDF et la watchlist sont maintenant accessibles directement depuis la premiere visite.",
    phaseCta: "Ouvrir Investigation",
    phaseSecondary: "Tester la recherche IA",
    phaseCards: [
      {
        title: "Toile d'investigation",
        body: "Adresse, matricule, RBQ, entreprise ou SEAO deviennent un graphe de preuves cliquable.",
      },
      {
        title: "Score risque + opportunite",
        body: "Patrimoine, contamination, inspections, ventes et signaux de marche deviennent un verdict.",
      },
      {
        title: "Rapport PDF diligence",
        body: "Un dossier partageable est genere depuis les memes preuves tracables.",
      },
      {
        title: "Watchlist automatique",
        body: "Les proprietes suivies creent des notifications quand les donnees changent.",
      },
    ],
    searchTitle: "Interroger toute la couche d'intelligence",
    searchDescription:
      "Cherchez ensuite une adresse, une municipalité, une entreprise, un permis, un avis SEAO ou une contrainte précise.",
    atlasTitle: "Couverture municipale vérifiable",
    atlasDescription:
      "La carte distingue les sources indexées des sources partielles, documentaires ou indisponibles.",
    permitDecision: "Le signal est récent, mais il doit être qualifié contre votre licence RBQ et la portée réelle des travaux.",
    permitNext: "Ouvrir la source municipale, confirmer le dossier individuel et identifier un contact utilisable légalement.",
    tenderDecision: "L'échéance approche; les documents, addendas et exigences d'admissibilité doivent être lus avant une décision de soumission.",
    tenderNext: "Ouvrir l'avis SEAO, télécharger les documents et décider si le dossier mérite une analyse complète.",
    permitConfirmed: "Permis municipal indexé",
    tenderConfirmed: "Avis SEAO ouvert indexé",
    sourceConfirmed: "Lien vers la source publique disponible",
    dateConfirmed: "Date publique normalisée",
    rbqCheck: "Adéquation des sous-catégories RBQ",
    territoryCheck: "Territoire et capacité opérationnelle",
    contactCheck: "Demandeur, donneur d'ouvrage ou contact à confirmer",
    ampCheck: "Autorisation AMP et conditions d'admissibilité",
    documentsCheck: "Documents, addendas et portée contractuelle",
    municipalityDataset: "Source municipale",
    seaoSource: "SEAO",
    valueUnknown: "Valeur non publiée",
    deadlineUnknown: "Échéance non publiée",
    observed: "Publié le {date}",
    closes: "Clôture le {date}",
  },
  en: {
    phaseEyebrow: "NEW IN PRODUCTION",
    phaseTitle: "Phase 3 is now visible on the homepage.",
    phaseDescription:
      "The investigation graph, risk score, PDF report, and watchlist are now reachable from the first visit.",
    phaseCta: "Open Investigation",
    phaseSecondary: "Test AI search",
    phaseCards: [
      {
        title: "Investigation canvas",
        body: "Address, matricule, RBQ, company, or SEAO records become a clickable evidence graph.",
      },
      {
        title: "Risk + opportunity score",
        body: "Heritage, contamination, inspections, sales, and market signals become one verdict.",
      },
      {
        title: "Diligence PDF report",
        body: "A shareable dossier is generated from the same traceable evidence.",
      },
      {
        title: "Automatic watchlist",
        body: "Followed properties create notifications when indexed data changes.",
      },
    ],
    searchTitle: "Query the complete intelligence layer",
    searchDescription:
      "Then search an address, municipality, company, permit, SEAO notice, or specific constraint.",
    atlasTitle: "Verifiable municipal coverage",
    atlasDescription:
      "The map separates indexed sources from partial, document-only, and unavailable sources.",
    permitDecision: "The signal is recent, but it must be qualified against your RBQ licence and the actual work scope.",
    permitNext: "Open the municipal source, confirm the individual record, and identify a legally usable contact.",
    tenderDecision: "The deadline is approaching; documents, addenda, and eligibility requirements must be reviewed before a bid decision.",
    tenderNext: "Open the SEAO notice, download the documents, and decide whether the record merits full analysis.",
    permitConfirmed: "Indexed municipal permit",
    tenderConfirmed: "Indexed open SEAO notice",
    sourceConfirmed: "Public source link available",
    dateConfirmed: "Public date normalized",
    rbqCheck: "RBQ subclass fit",
    territoryCheck: "Territory and operating capacity",
    contactCheck: "Applicant, buyer, or contact must be confirmed",
    ampCheck: "AMP authorization and eligibility conditions",
    documentsCheck: "Documents, addenda, and contract scope",
    municipalityDataset: "Municipal source",
    seaoSource: "SEAO",
    valueUnknown: "Value not published",
    deadlineUnknown: "Deadline not published",
    observed: "Published {date}",
    closes: "Closes {date}",
  },
} as const;

function interpolate(template: string, date: string) {
  return template.replace("{date}", date);
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "fr" ? "fr" : "en";
  const user = await getSessionUser();
  if (user) redirect(`/${locale}/feed`);

  const copy = COPY[locale];
  const now = new Date();
  const [stats, permits, tenders] = await Promise.all([
    fetchMarketPulseStats(),
    prisma.permit.findMany({
      where: { issueDate: { not: null } },
      orderBy: { issueDate: "desc" },
      take: 5,
      select: {
        id: true,
        permitType: true,
        address: true,
        borough: true,
        city: true,
        estimatedCost: true,
        issueDate: true,
        sourceUrl: true,
      },
    }),
    prisma.tender.findMany({
      where: {
        closesAt: { gte: now },
        AND: [
          { OR: [{ status: null }, { status: { not: "closed" } }] },
          {
            OR: [
              { title: { contains: "travaux" } },
              { title: { contains: "construction" } },
              { title: { contains: "rénovation" } },
              { title: { contains: "réfection" } },
              { title: { contains: "toiture" } },
              { title: { contains: "fenêtres" } },
              { title: { contains: "bâtiment" } },
              { category: { contains: "construction" } },
            ],
          },
        ],
      },
      orderBy: { closesAt: "asc" },
      take: 7,
      select: {
        id: true,
        title: true,
        organization: true,
        region: true,
        estimatedValue: true,
        closesAt: true,
        requiresAmp: true,
        sourceUrl: true,
      },
    }),
  ]);

  const dateFormatter = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const tenderItems: PublicDeskOpportunity[] = tenders.map((tender) => {
    const daysLeft = tender.closesAt
      ? differenceInCalendarDays(tender.closesAt, now)
      : null;
    const decision = daysLeft != null && daysLeft <= 7 ? "review" : "watch";
    const deadline = tender.closesAt ? dateFormatter.format(tender.closesAt) : null;
    return {
      id: `tender:${tender.id}`,
      kind: "tender",
      title: tender.title,
      location: tender.region ?? tender.organization ?? "Québec",
      organization: tender.organization ?? copy.seaoSource,
      valueLabel: tender.estimatedValue
        ? formatCad(tender.estimatedValue, locale)
        : copy.valueUnknown,
      dateLabel: deadline ? interpolate(copy.closes, deadline) : copy.deadlineUnknown,
      decision,
      reason: copy.tenderDecision,
      confirmed: [
        copy.tenderConfirmed,
        copy.sourceConfirmed,
        ...(deadline ? [copy.dateConfirmed] : []),
      ],
      checks: [
        copy.documentsCheck,
        tender.requiresAmp ? copy.ampCheck : copy.rbqCheck,
        copy.territoryCheck,
      ],
      nextAction: copy.tenderNext,
      sourceUrl: tender.sourceUrl,
      sourceLabel: copy.seaoSource,
    };
  });

  const permitItems: PublicDeskOpportunity[] = permits.map((permit) => {
    const observed = permit.issueDate ? dateFormatter.format(permit.issueDate) : null;
    return {
      id: `permit:${permit.id}`,
      kind: "permit",
      title: `${permit.permitType} - ${permit.address}`,
      location: permit.borough ?? permit.city,
      organization: copy.municipalityDataset,
      valueLabel: permit.estimatedCost
        ? formatCad(permit.estimatedCost, locale)
        : copy.valueUnknown,
      dateLabel: observed ? interpolate(copy.observed, observed) : copy.deadlineUnknown,
      decision: "qualify",
      reason: copy.permitDecision,
      confirmed: [
        copy.permitConfirmed,
        copy.sourceConfirmed,
        ...(observed ? [copy.dateConfirmed] : []),
      ],
      checks: [copy.rbqCheck, copy.contactCheck, copy.territoryCheck],
      nextAction: copy.permitNext,
      sourceUrl: permit.sourceUrl,
      sourceLabel: copy.municipalityDataset,
    };
  });

  return (
    <div className="bg-bg text-ink">
      <PublicContractorDesk
        locale={locale}
        items={[...tenderItems, ...permitItems]}
        stats={{
          permitsWeek: stats.permitsWeek,
          tendersOpen: stats.tendersOpen,
          tendersClosingWeek: stats.tendersClosingWeek,
          tendersClosingThursday: stats.tendersClosingThursday,
          indexedDatasets: stats.datasetCount,
        }}
        updatedAt={stats.updatedAt}
      />

      <section className="border-b border-line bg-ink text-white" data-phase-three-visible>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              {copy.phaseEyebrow}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight md:text-3xl">
              {copy.phaseTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {copy.phaseDescription}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/investigate"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                <Network className="h-4 w-4" aria-hidden="true" />
                {copy.phaseCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#phase-intelligence-search"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/20 px-4 text-sm font-semibold text-white hover:bg-white/10"
              >
                <BrainCircuit className="h-4 w-4" aria-hidden="true" />
                {copy.phaseSecondary}
              </a>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.phaseCards.map((card, index) => {
              const Icon = [Network, BrainCircuit, FileSearch, BellRing][index] ?? Network;
              return (
                <div key={card.title} className="rounded-lg border border-white/15 bg-white/10 p-4">
                  <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
                  <h3 className="mt-3 text-sm font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{card.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="phase-intelligence-search" className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="mb-7 max-w-3xl">
            <h2 className="font-display text-2xl font-semibold text-ink md:text-3xl">
              {copy.searchTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">{copy.searchDescription}</p>
          </div>
          <QuebecIntelligenceSearch embedded />
        </div>
      </section>

      <QuebecCoverageBar />

      <section id="atlas" className="mx-auto grid max-w-7xl gap-6 px-4 py-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink md:text-3xl">
            {copy.atlasTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">{copy.atlasDescription}</p>
        </div>
        <QuebecAtlasMap />
      </section>
    </div>
  );
}
