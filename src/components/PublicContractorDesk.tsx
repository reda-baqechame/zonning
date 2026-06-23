"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileSearch,
  Search,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

export type PublicDeskOpportunity = {
  id: string;
  kind: "permit" | "tender";
  title: string;
  location: string;
  organization: string;
  valueLabel: string;
  dateLabel: string;
  decision: "review" | "qualify" | "watch";
  reason: string;
  confirmed: string[];
  checks: string[];
  nextAction: string;
  sourceUrl: string;
  sourceLabel: string;
};

type DeskStats = {
  permitsWeek: number;
  tendersOpen: number;
  tendersClosingWeek: number;
  tendersClosingThursday: number;
  indexedDatasets: number;
};

const COPY = {
  fr: {
    title: "Trouvez les contrats et permis qui valent votre temps.",
    description:
      "ZONNING classe les permis municipaux et avis SEAO en actions simples: poursuivre, vérifier, surveiller ou ignorer.",
    openCockpit: "Créer mon espace",
    signIn: "Connexion",
    queue: "Décisions du jour",
    dossier: "Dossier ouvert",
    search: "Rechercher un dossier ou une région",
    sourceFilter: "Filtrer par source",
    all: "Tout",
    permits: "Permis",
    tenders: "SEAO",
    opportunity: "Occasion",
    location: "Lieu",
    valueDate: "Valeur / échéance",
    decision: "Décision",
    confirmed: "Ce qui est confirmé",
    verify: "À vérifier",
    nextAction: "Ce que vous devez faire maintenant",
    officialSource: "Ouvrir la source officielle",
    personalize: "Classer selon mon RBQ et mon territoire",
    noMatch: "Aucun dossier ne correspond à cette recherche.",
    stats: ["permis émis (7 j)", "clôturent jeudi", "avis SEAO ouverts", "jeux de données actifs"],
    howTitle: "Comment utiliser ZONNING",
    howSteps: [
      "Complétez votre profil RBQ",
      "Consultez les décisions du jour",
      "Ouvrez un dossier",
      "Vérifiez les preuves et documents officiels",
      "Ajoutez au suivi",
    ],
    painPoints: [
      {
        title: "Moins de temps perdu",
        body: "Les dossiers faibles sont séparés des occasions à traiter avant votre prochaine estimation.",
      },
      {
        title: "Échéances visibles",
        body: "Les avis SEAO urgents et les clôtures du jeudi remontent dans votre file de travail.",
      },
      {
        title: "Blocages expliqués",
        body: "RBQ, AMP, documents et preuves officielles sont affichés avant de poursuivre un dossier.",
      },
    ],
    decisions: {
      review: "Poursuivre",
      qualify: "Vérifier",
      watch: "Surveiller",
    },
  },
  en: {
    title: "Find the contracts and permits worth your time.",
    description:
      "ZONNING turns municipal permits and SEAO notices into simple actions: pursue, verify, watch, or ignore.",
    openCockpit: "Create my workspace",
    signIn: "Sign in",
    queue: "Today's decisions",
    dossier: "Open dossier",
    search: "Search a record or region",
    sourceFilter: "Filter by source",
    all: "All",
    permits: "Permits",
    tenders: "SEAO",
    opportunity: "Opportunity",
    location: "Location",
    valueDate: "Value / deadline",
    decision: "Decision",
    confirmed: "What is confirmed",
    verify: "Verify",
    nextAction: "What to do now",
    officialSource: "Open official source",
    personalize: "Rank for my RBQ profile and territory",
    noMatch: "No record matches this search.",
    stats: ["permits issued (7d)", "close Thursday", "open SEAO notices", "active datasets"],
    howTitle: "How to use ZONNING",
    howSteps: [
      "Complete your RBQ profile",
      "Review today's decisions",
      "Open a dossier",
      "Verify official proof and documents",
      "Add it to follow-up",
    ],
    painPoints: [
      {
        title: "Less wasted time",
        body: "Weak records are separated from opportunities worth reviewing before your next estimate.",
      },
      {
        title: "Deadlines visible",
        body: "Urgent SEAO notices and Thursday closes rise to the top of your work queue.",
      },
      {
        title: "Blockers explained",
        body: "RBQ, AMP, documents, and official proof are shown before you pursue a file.",
      },
    ],
    decisions: {
      review: "Pursue",
      qualify: "Verify",
      watch: "Watch",
    },
  },
} as const;

const PAIN_ICONS = [Building2, CalendarClock, CircleAlert] as const;

const DECISION_STYLE = {
  review: "border-danger/30 bg-danger-soft text-danger",
  qualify: "border-warning/40 bg-warning-soft text-warning-ink",
  watch: "border-brand/20 bg-brand-soft text-brand",
} as const;

export default function PublicContractorDesk({
  locale,
  items,
  stats,
  updatedAt,
}: {
  locale: "fr" | "en";
  items: PublicDeskOpportunity[];
  stats: DeskStats;
  updatedAt: string;
}) {
  const copy = COPY[locale];
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "permit" | "tender">("all");
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale === "fr" ? "fr-CA" : "en-CA");
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (!normalized) return true;
      return [item.title, item.location, item.organization]
        .join(" ")
        .toLocaleLowerCase(locale === "fr" ? "fr-CA" : "en-CA")
        .includes(normalized);
    });
  }, [items, kind, locale, query]);

  const selected =
    visibleItems.find((item) => item.id === selectedId) ?? visibleItems[0] ?? null;
  const updatedLabel = new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Toronto",
  }).format(new Date(updatedAt));
  const statValues = [
    stats.permitsWeek,
    stats.tendersClosingThursday,
    stats.tendersOpen,
    stats.indexedDatasets,
  ];

  return (
    <section className="border-b border-line bg-[#f5f8fc]" data-public-contractor-desk>
      <div className="mx-auto max-w-[1500px] px-4 py-7 lg:px-6 lg:py-9">
        <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="font-display text-3xl font-semibold leading-tight text-ink md:text-4xl">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
              {copy.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-hover"
            >
              {copy.signIn}
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
            >
              {copy.openCockpit}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="grid border-x border-line bg-white md:grid-cols-[220px_1fr]">
          <div className="border-b border-line px-5 py-4 md:border-b-0 md:border-r">
            <p className="text-sm font-semibold text-ink">{copy.howTitle}</p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {locale === "fr"
                ? "Suivez ces étapes dans l'ordre; chaque dossier garde le lien vers la source officielle."
                : "Follow these steps in order; every dossier keeps the official source link."}
            </p>
          </div>
          <ol className="grid gap-0 sm:grid-cols-2 xl:grid-cols-5">
            {copy.howSteps.map((step, index) => (
              <li
                key={step}
                className="flex gap-3 border-b border-line px-4 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {index + 1}
                </span>
                <span className="text-sm font-medium leading-5 text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-2 border-x border-line bg-white lg:grid-cols-4 lg:border-b">
          {statValues.map((value, index) => (
            <div key={copy.stats[index]} className="border-b border-line px-5 py-4 odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
              <p className="font-display text-2xl font-semibold tabular-nums text-ink">{value}</p>
              <p className="mt-1 text-xs text-muted">{copy.stats[index]}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {copy.painPoints.map((point, index) => {
            const Icon = PAIN_ICONS[index] ?? Building2;
            return (
              <div key={point.title} className="flex gap-3 rounded-md border border-line bg-white p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-ink">{point.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{point.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-w-0 border border-line bg-white">
            <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">{copy.queue}</h2>
                <p className="mt-1 text-xs text-muted">
                  {items.length} dossiers · {updatedLabel}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block min-w-0 sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={copy.search}
                    aria-label={copy.search}
                    className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-ring"
                  />
                </label>
                <div className="flex rounded-md border border-line bg-white p-0.5" aria-label={copy.sourceFilter}>
                  {([
                    ["all", copy.all],
                    ["permit", copy.permits],
                    ["tender", copy.tenders],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={kind === value}
                      onClick={() => setKind(value)}
                      className={`h-8 rounded px-3 text-xs font-semibold ${kind === value ? "bg-brand text-white" : "text-muted hover:bg-surface-hover"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden grid-cols-[132px_minmax(250px,1.5fr)_minmax(150px,0.8fr)_minmax(150px,0.7fr)] border-b border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold text-muted lg:grid">
              <span>{copy.decision}</span>
              <span>{copy.opportunity}</span>
              <span>{copy.location}</span>
              <span>{copy.valueDate}</span>
            </div>

            <div className="max-h-[430px] overflow-y-auto">
              {visibleItems.length ? visibleItems.map((item) => {
                const active = selected?.id === item.id;
                const KindIcon = item.kind === "permit" ? Building2 : FileSearch;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-public-opportunity={item.id}
                    aria-pressed={active}
                    onClick={() => setSelectedId(item.id)}
                    className={`grid w-full gap-2 border-b border-line px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-hover lg:grid-cols-[132px_minmax(250px,1.5fr)_minmax(150px,0.8fr)_minmax(150px,0.7fr)] lg:items-center ${active ? "bg-brand-soft shadow-[inset_3px_0_0_var(--color-brand)]" : "bg-white"}`}
                  >
                    <span className={`w-fit rounded border px-2 py-1 text-[11px] font-semibold ${DECISION_STYLE[item.decision]}`}>
                      {copy.decisions[item.decision]}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-semibold text-ink">
                        <KindIcon className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                        <span className="truncate">{item.title}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">{item.organization}</span>
                    </span>
                    <span className="truncate text-sm text-ink">{item.location}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{item.valueLabel}</span>
                      <span className="mt-1 block text-xs text-muted">{item.dateLabel}</span>
                    </span>
                  </button>
                );
              }) : (
                <p className="px-5 py-12 text-center text-sm text-muted">{copy.noMatch}</p>
              )}
            </div>
          </div>

          <aside className="border border-line bg-white" aria-label={copy.dossier}>
            {selected ? (
              <>
                <div className="border-b border-line px-5 py-4">
                  <p className="text-xs font-medium text-muted">{copy.dossier}</p>
                  <h2 className="mt-1 font-display text-xl font-semibold leading-7 text-ink">{selected.title}</h2>
                  <p className="mt-1 text-sm text-muted">{selected.location}</p>
                </div>
                <div className="space-y-5 p-5">
                  <section className="border-l-2 border-brand pl-4">
                    <p className={`w-fit rounded border px-2 py-1 text-[11px] font-semibold ${DECISION_STYLE[selected.decision]}`}>
                      {copy.decisions[selected.decision]}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted">{selected.reason}</p>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-ink">{copy.confirmed}</h3>
                    <div className="divide-y divide-line border border-line">
                      {selected.confirmed.map((fact) => (
                        <div key={fact} className="flex gap-3 px-3 py-2.5">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                          <p className="text-sm leading-5 text-ink">{fact}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-ink">{copy.verify}</h3>
                    <div className="divide-y divide-line border border-line">
                      {selected.checks.map((check) => (
                        <div key={check} className="flex gap-3 px-3 py-2.5">
                          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                          <p className="text-sm leading-5 text-ink">{check}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">{copy.nextAction}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted">{selected.nextAction}</p>
                  </section>

                  <div className="grid gap-2 border-t border-line pt-4">
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-brand text-sm font-semibold text-brand hover:bg-brand-soft"
                    >
                      {copy.officialSource}
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                    <Link
                      href="/register"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover"
                    >
                      {copy.personalize}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid min-h-80 place-items-center p-6 text-center text-sm text-muted">
                {copy.noMatch}
              </div>
            )}
          </aside>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          {locale === "fr"
            ? "Aucun dossier n'est qualifié pour votre entreprise avant la configuration du profil RBQ, du territoire et du budget."
            : "No record is qualified for your company until RBQ profile, territory, and budget are configured."}
        </div>
      </div>
    </section>
  );
}
