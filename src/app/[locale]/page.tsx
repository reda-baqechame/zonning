import { differenceInCalendarDays } from "date-fns";
import { redirect } from "next/navigation";
import PublicContractorDesk, {
  type PublicDeskOpportunity,
} from "@/components/PublicContractorDesk";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import QuebecAtlasMap from "@/components/QuebecAtlasMap";
import QuebecIntelligenceSearch from "@/components/QuebecIntelligenceSearch";
import { getSessionUser } from "@/lib/auth";
import { formatCad } from "@/lib/format-cad";
import { fetchMarketPulseStats } from "@/lib/market-pulse";
import { prisma } from "@/lib/prisma";

const COPY = {
  fr: {
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
          indexedDatasets: stats.datasetCount,
        }}
        updatedAt={stats.updatedAt}
      />

      <section className="border-b border-line bg-white">
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
