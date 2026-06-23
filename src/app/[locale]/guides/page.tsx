import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  GOVERNMENT_SITE_GUIDES,
  GUIDE_CATEGORIES,
  localize,
  type Locale,
} from "@/content/government-sites";
import { ArrowRight, ExternalLink } from "lucide-react";

export function generateStaticParams() {
  return [{ locale: "fr" }, { locale: "en" }];
}

export default async function GuidesIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "fr") as Locale;
  setRequestLocale(loc);
  const t = await getTranslations({ locale: loc, namespace: "guides" });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{t("indexTitle")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("indexSubtitle")}</p>
      </header>

      {GUIDE_CATEGORIES.map((cat) => {
        const guides = GOVERNMENT_SITE_GUIDES.filter((g) => g.category === cat.id);
        if (guides.length === 0) return null;
        return (
          <section key={cat.id} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase text-subtle">
              {localize(cat, loc)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {guides.map((g) => (
                <Link
                  key={g.slug}
                  href={`/guides/${g.slug}`}
                  className="group flex flex-col rounded-lg border border-line bg-white p-4 hover:border-brand"
                >
                  <span className="flex items-center justify-between">
                    <span className="text-base font-semibold text-ink">{g.name}</span>
                    <ArrowRight className="h-4 w-4 text-brand transition group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-1 text-sm text-muted">{localize(g.purpose, loc)}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-8 text-xs text-subtle">
        {t("indexFooter")}{" "}
        <a
          href="https://www.donneesquebec.ca/licence/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
        >
          Licence ouverte / Open Government Licence
          <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </main>
  );
}
