"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Building2, FileSearch, Landmark, Mail, MapPin, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { Button, Input } from "@/components/ui";

type SearchResult = {
  id: string;
  kind: "site" | "municipality" | "permit" | "tender" | "company" | "dataset";
  title: string;
  subtitle: string;
  href: string;
  confidence: number;
  coverageStatus: string;
  freshness: string;
  source: {
    title: string;
    url: string;
  };
  signals: string[];
  limitations: string[];
  recommendedNextAction: string;
};

const KIND_ICON = {
  site: MapPin,
  municipality: Landmark,
  permit: FileSearch,
  tender: FileSearch,
  company: Building2,
  dataset: ShieldCheck,
} as const;

const EXAMPLES = [
  "500 boul. René-Lévesque Ouest",
  "Montréal",
  "RBQ plomberie Laval",
  "SEAO toiture Québec",
  "terrain contaminé Longueuil",
];

const COPY = {
  fr: {
    eyebrow: "Recherche dans les données du Québec",
    title: "Rechercher dans les dossiers de construction vérifiés.",
    description:
      "Entrez une adresse, une municipalité, un permis, un appel d'offres SEAO, une entreprise, une licence RBQ ou une contrainte. Les résultats distinguent les données trouvées de celles qui restent indisponibles.",
    placeholder: "Adresse, municipalité, RBQ, appel d'offres, permis...",
    ariaLabel: "Rechercher dans les données de construction du Québec",
    search: "Rechercher",
    searching: "Recherche...",
    searchFailed: "La recherche a échoué. Réessayez.",
    features: [
      "Explication en langage clair avec chaque recommandation",
      "Source, confiance, fraîcheur et limites affichées",
      "Les preuves manquantes retournent un état indisponible",
      "Liens directs vers les sources publiques du Québec",
    ],
    snapshot: "Aperçu des données",
    emptyTitle: "Le premier résultat s'affichera ici.",
    emptyDescription:
      "Essayez une municipalité, une adresse civique, une entreprise, un permis, un appel d'offres, une source de zonage ou une contrainte.",
    noMatch:
      "Aucun résultat indexé. Essayez une municipalité plus large ou le nom d'une source officielle.",
    confidence: "Preuves",
    freshness: "Fraîcheur",
    source: "Source",
    signals: "Signaux",
    limitations: "Limites",
    nextAction: "Prochaine action",
    openEvidence: "Ouvrir les preuves",
    reviewCoverage: "Vérifier la couverture",
    kinds: {
      site: "site",
      municipality: "municipalité",
      permit: "permis",
      tender: "appel d'offres",
      company: "entreprise",
      dataset: "source",
    },
    statuses: {
      authoritative: "source officielle indexée",
      partial: "couverture partielle",
      context_only: "contexte seulement",
      unavailable: "indisponible",
      document_only: "source enregistrée seulement",
    },
  },
  en: {
    eyebrow: "Quebec construction data search",
    title: "Search verified Quebec construction records.",
    description:
      "Enter an address, municipality, permit, SEAO tender, company, RBQ licence, or constraint. Results distinguish indexed matches from evidence that remains unavailable.",
    placeholder: "Address, municipality, RBQ, tender, permit...",
    ariaLabel: "Search Quebec construction data",
    search: "Search",
    searching: "Searching...",
    searchFailed: "Search failed. Please try again.",
    features: [
      "Plain-language explanation beside every recommendation",
      "Source, proof, freshness, and limitations shown",
      "Missing evidence returns an unavailable state",
      "Direct links to Quebec public sources",
    ],
    snapshot: "Data snapshot",
    emptyTitle: "Your first result opens here.",
    emptyDescription:
      "Try a municipality, civic address, company, permit, tender, zoning source, or constraint.",
    noMatch:
      "No indexed result matched. Try a broader municipality or an official source name.",
    confidence: "Proof",
    freshness: "Freshness",
    source: "Source",
    signals: "Signals",
    limitations: "Limitations",
    nextAction: "Next action",
    openEvidence: "Open evidence",
    reviewCoverage: "Review coverage",
    kinds: {
      site: "site",
      municipality: "municipality",
      permit: "permit",
      tender: "tender",
      company: "company",
      dataset: "source",
    },
    statuses: {
      authoritative: "authoritative indexed source",
      partial: "partial coverage",
      context_only: "context only",
      unavailable: "unavailable",
      document_only: "registered source only",
    },
  },
} as const;

type SearchCopy = (typeof COPY)[keyof typeof COPY];

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default function QuebecIntelligenceSearch({ embedded = false }: { embedded?: boolean }) {
  const locale = useLocale() as "fr" | "en";
  const copy = COPY[locale];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const topResult = results[0];
  const secondary = useMemo(() => results.slice(1, 6), [results]);

  const submit = async (event?: FormEvent, overrideQuery?: string) => {
    event?.preventDefault();
    const q = (overrideQuery ?? query).trim();
    if (q.length < 2) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const res = await fetch(
        `/api/v2/search?q=${encodeURIComponent(q)}&locale=${locale}`,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? copy.searchFailed);
        setResults([]);
        return;
      }
      setResults(data?.results ?? []);
    } catch {
      setError(copy.searchFailed);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          {!embedded ? (
            <>
              <p className="text-sm font-semibold uppercase text-brand">
                {copy.eyebrow}
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold text-ink md:text-4xl">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                {copy.description}
              </p>
            </>
          ) : null}

          <form onSubmit={submit} className={`${embedded ? "" : "mt-6"} rounded-lg border border-line bg-surface-2 p-2 shadow-sm`}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.placeholder}
                className="min-h-12 flex-1 border-0 bg-white text-base shadow-sm"
                aria-label={copy.ariaLabel}
              />
              <Button type="submit" disabled={loading} className="min-h-12 px-6">
                {loading ? copy.searching : copy.search}
              </Button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  queueMicrotask(() => void submit(undefined, example));
                }}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted hover:border-brand-border hover:text-brand"
              >
                {example}
              </button>
            ))}
          </div>

          {!embedded ? (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {copy.features.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-muted">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-line bg-surface-2 p-4">
          {error ? (
            <div className="rounded-xl border border-danger/20 bg-danger-soft p-4 text-sm text-danger">
              {error}
            </div>
          ) : topResult ? (
            <div className="space-y-4">
              <SnapshotCard result={topResult} copy={copy} featured />
              {topResult.kind === "site" && topResult.confidence > 0 && topResult.signals.length > 0 && (
                <EmailSnapshotForm query={query} locale={locale} />
              )}
              {secondary.length > 0 && (
                <div className="grid gap-3">
                  {secondary.map((result) => (
                    <SnapshotCard key={`${result.kind}-${result.id}`} result={result} copy={copy} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-line bg-white p-6">
              <p className="text-xs font-semibold uppercase text-brand">
                {copy.snapshot}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                {copy.emptyTitle}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {copy.emptyDescription}
              </p>
              {searched && !loading && (
                <p className="mt-4 rounded-xl bg-warning-soft p-3 text-sm text-warning-ink">
                  {copy.noMatch}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function EmailSnapshotForm({ query, locale }: { query: string; locale: "fr" | "en" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || query.trim().length < 2) return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/v2/reports/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), query: query.trim(), locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? (locale === "fr" ? "Échec envoi" : "Send failed"));
        return;
      }
      setStatus("sent");
      setMessage(
        locale === "fr"
          ? "Aperçu envoyé — vérifiez votre boîte courriel."
          : "Snapshot sent — check your inbox."
      );
    } catch {
      setStatus("error");
      setMessage(locale === "fr" ? "Erreur réseau" : "Network error");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-brand-border bg-brand-soft/40 p-4"
    >
      <div className="flex items-center gap-2 text-brand">
        <Mail className="h-4 w-4" />
        <p className="text-sm font-semibold">
          {locale === "fr" ? "Recevoir cet aperçu par courriel" : "Email me this snapshot"}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">
        {locale === "fr"
          ? "Sources, confiance, limites et lien vers le dossier — sans inscription préalable."
          : "Sources, proof, limitations, and dossier link - no signup required first."}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={locale === "fr" ? "votre@courriel.com" : "you@company.com"}
          className="min-h-11 flex-1 bg-white"
          disabled={status === "loading" || status === "sent"}
        />
        <Button type="submit" disabled={status === "loading" || status === "sent"} className="min-h-11 shrink-0">
          {status === "loading"
            ? locale === "fr"
              ? "Envoi…"
              : "Sending…"
            : locale === "fr"
              ? "Envoyer"
              : "Send"}
        </Button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${status === "error" ? "text-danger" : "text-success"}`}>
          {message}
        </p>
      )}
    </form>
  );
}

function SnapshotCard({
  result,
  copy,
  featured = false,
}: {
  result: SearchResult;
  copy: SearchCopy;
  featured?: boolean;
}) {
  const Icon = KIND_ICON[result.kind];
  const status =
    result.coverageStatus in copy.statuses
      ? copy.statuses[result.coverageStatus as keyof typeof copy.statuses]
      : result.coverageStatus;
  return (
    <article className={`rounded-lg border border-line bg-white p-4 shadow-sm ${featured ? "md:p-5" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-border bg-brand-soft text-brand">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtle">
              {copy.kinds[result.kind]}
            </span>
            <span className="rounded-full bg-brand-soft px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand">
              {status}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{result.title}</h3>
          <p className="mt-1 text-sm leading-5 text-muted">{result.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-subtle">{copy.confidence}</p>
          <p className="mt-1 font-semibold text-ink">{pct(result.confidence)}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-subtle">{copy.freshness}</p>
          <p className="mt-1 font-semibold text-ink">{result.freshness}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-subtle">{copy.source}</p>
          <a href={result.source.url} target="_blank" rel="noreferrer" className="mt-1 block truncate font-semibold text-brand hover:underline">
            {result.source.title}
          </a>
        </div>
      </div>

      {featured && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-subtle">{copy.signals}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {result.signals.slice(0, 4).map((signal) => (
                <li key={signal}>• {signal}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-subtle">{copy.limitations}</p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {result.limitations.slice(0, 3).map((limitation) => (
                <li key={limitation}>• {limitation}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-xl text-sm text-ink">
          <span className="font-semibold">{copy.nextAction}:</span> {result.recommendedNextAction}
        </p>
        <Link href={result.href} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-hover">
          {result.confidence > 0 ? copy.openEvidence : copy.reviewCoverage}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}
