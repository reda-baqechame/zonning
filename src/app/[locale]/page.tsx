import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import QuebecAtlasMap from "@/components/QuebecAtlasMap";
import QuebecIntelligenceSearch from "@/components/QuebecIntelligenceSearch";
import { COVERAGE_CITIES, getDatasetCount, getRegisteredSourceCount } from "@/lib/datasets/registry";
import { ShieldCheck } from "lucide-react";

const HOME_COPY = {
  fr: {
    atlasEyebrow: "Atlas du Québec",
    atlasTitle: "Une couverture municipale qui montre ce qui est indexé et ce qui manque.",
    atlasDescription:
      "ZONNING sépare les enregistrements réellement indexés des sources enregistrées qui n'ont pas encore d'adaptateur d'ingestion fonctionnel.",
    trackedCities: "villes suivies",
    indexedDatasets: "jeux indexés",
    registeredSources: "sources enregistrées",
    trustTitle: "Règle de confiance appliquée au produit",
    trustDescription:
      "Chaque résultat doit afficher une source, sa fraîcheur, un niveau de confiance et ses limites. Les preuves manquantes retournent un état indisponible plutôt qu'une conclusion positive. ZONNING fournit de l'information opérationnelle, pas une autorisation juridique.",
  },
  en: {
    atlasEyebrow: "Quebec atlas",
    atlasTitle: "Municipal coverage that shows what is indexed and what is still missing.",
    atlasDescription:
      "ZONNING separates records actually indexed from registered sources that do not yet have a working ingestion adapter.",
    trackedCities: "tracked cities",
    indexedDatasets: "indexed datasets",
    registeredSources: "registered sources",
    trustTitle: "Trust rule applied to the product",
    trustDescription:
      "Every result must show a source, freshness, confidence, and limitations. Missing evidence returns an unavailable state instead of a positive conclusion. ZONNING provides operational information, not legal authorization.",
  },
} as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = HOME_COPY[locale === "fr" ? "fr" : "en"];
  const indexedDatasets = getDatasetCount();
  const registeredSources = getRegisteredSourceCount();
  const trackedCities = COVERAGE_CITIES.length;

  return (
    <div className="bg-bg text-ink">
      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:py-12">
          <QuebecIntelligenceSearch />
        </div>
      </section>

      <QuebecCoverageBar />

      <section id="atlas" className="mx-auto grid max-w-7xl gap-6 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-brand">{copy.atlasEyebrow}</p>
          <h2 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">
            {copy.atlasTitle}
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted">
            {copy.atlasDescription}
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              [trackedCities.toString(), copy.trackedCities],
              [indexedDatasets.toString(), copy.indexedDatasets],
              [registeredSources.toString(), copy.registeredSources],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl border border-line bg-white p-4 shadow-sm">
                <p className="text-2xl font-semibold text-brand">{value}</p>
                <p className="mt-1 text-xs leading-4 text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <QuebecAtlasMap />
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="rounded-2xl border border-success/20 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-success" />
            <div>
              <h2 className="text-xl font-semibold text-ink">{copy.trustTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {copy.trustDescription}
              </p>
            </div>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
