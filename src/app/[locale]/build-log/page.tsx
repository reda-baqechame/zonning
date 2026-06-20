import { Link } from "@/i18n/navigation";
import NextLink from "next/link";
import {
  COVERAGE_CITIES,
  getDatasetCount,
  getRegisteredSourceCount,
} from "@/lib/datasets/registry";

const COPY = {
  fr: {
    eyebrow: "Preuves du système",
    title: "Ce que ZONNING peut démontrer aujourd'hui",
    intro:
      "Cette page décrit les contrats de preuve du produit. Les volumes et la fraîcheur opérationnelle restent visibles dans la couverture et la santé des données.",
    indexed: "Jeux avec ingestion active",
    registered: "Sources enregistrées",
    cities: "Villes suivies",
    rules: [
      "Un résultat doit conserver le lien vers sa source publique.",
      "Une donnée manquante réduit la confiance; elle ne devient pas une conclusion positive.",
      "Le zonage distingue une règle parcellaire, un signal de planification voisin et un résumé municipal.",
      "Les permis et appels d'offres sont classés selon l'adéquation et la qualité des preuves, séparément.",
      "Les connecteurs documentaires ou incomplets ne sont pas comptés comme couverture active.",
    ],
    coverage: "Examiner la couverture",
    health: "Examiner la santé des données",
  },
  en: {
    eyebrow: "System evidence",
    title: "What ZONNING can demonstrate today",
    intro:
      "This page describes the product evidence contracts. Operational volume and freshness remain visible in coverage and data health.",
    indexed: "Datasets with active ingestion",
    registered: "Registered sources",
    cities: "Tracked cities",
    rules: [
      "A result must preserve its public source link.",
      "Missing data lowers confidence; it does not become a positive conclusion.",
      "Zoning distinguishes parcel rules, nearby planning signals, and municipal summaries.",
      "Permits and tenders are ranked by fit and evidence quality as separate dimensions.",
      "Document-only or incomplete connectors are not counted as active coverage.",
    ],
    coverage: "Inspect coverage",
    health: "Inspect data health",
  },
} as const;

export default async function BuildLogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = COPY[locale === "fr" ? "fr" : "en"];
  const metrics = [
    [getDatasetCount(), copy.indexed],
    [getRegisteredSourceCount(), copy.registered],
    [COVERAGE_CITIES.length, copy.cities],
  ] as const;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 text-ink">
      <p className="text-sm font-semibold uppercase text-brand">{copy.eyebrow}</p>
      <h1 className="mt-3 max-w-3xl text-3xl font-semibold md:text-4xl">{copy.title}</h1>
      <p className="mt-4 max-w-3xl leading-7 text-muted">{copy.intro}</p>

      <dl className="mt-10 grid gap-3 sm:grid-cols-3">
        {metrics.map(([value, label]) => (
          <div key={label} className="border-y border-line py-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-3xl font-semibold text-brand">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-10 border-t border-line pt-8">
        <h2 className="text-xl font-semibold">Evidence rules</h2>
        <ol className="mt-5 grid gap-3">
          {copy.rules.map((rule, index) => (
            <li key={rule} className="flex gap-4 border-b border-line pb-3 text-sm leading-6 text-muted">
              <span className="font-semibold text-brand">{index + 1}</span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-8 flex flex-wrap gap-4 text-sm font-semibold">
        <Link href="/coverage" className="text-brand hover:underline">{copy.coverage}</Link>
        <NextLink href="/api/sync/health" className="text-brand hover:underline">{copy.health}</NextLink>
      </div>
    </main>
  );
}
