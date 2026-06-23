import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  GOVERNMENT_SITE_GUIDES,
  findGuide,
  localize,
  type Locale,
} from "@/content/government-sites";
import {
  ExternalLink,
  CircleAlert,
  CheckCircle2,
  LifeBuoy,
  FileText,
} from "lucide-react";

export function generateStaticParams() {
  const locales = ["fr", "en"];
  return locales.flatMap((locale) =>
    GOVERNMENT_SITE_GUIDES.map((g) => ({ locale, site: g.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; site: string }>;
}) {
  const { site } = await params;
  const guide = findGuide(site);
  if (!guide) return {};
  return {
    title: `${guide.name} — ZONNING guides`,
    description: guide.purpose.en,
  };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ locale: string; site: string }>;
}) {
  const { locale, site } = await params;
  const loc = (locale === "en" ? "en" : "fr") as Locale;
  setRequestLocale(loc);
  const guide = findGuide(site);
  if (!guide) notFound();

  const t = await getTranslations({ locale: loc, namespace: "guides" });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink">{guide.name}</h1>
        <p className="mt-2 text-sm text-muted">{localize(guide.purpose, loc)}</p>
        <a
          href={guide.href}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
        >
          {t("openOfficial", { name: guide.name })}
          <ExternalLink className="h-4 w-4" />
        </a>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label={t("whenNeeded")} value={localize(guide.whenNeeded, loc)} />
        <Fact label={t("accountRequired")} value={localize(guide.accountRequired, loc)} />
      </div>

      <div className="mt-4 rounded-lg border border-line bg-white p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase text-subtle">
          <FileText className="h-3.5 w-3.5" /> {t("produces")}
        </p>
        <p className="mt-1 text-sm text-muted">{localize(guide.produces, loc)}</p>
      </div>

      {/* Ordered steps */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">{t("stepsTitle")}</h2>
        <ol className="mt-3 space-y-2">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 rounded-md border border-line p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{localize(step.title, loc)}</p>
                <p className="mt-0.5 text-sm text-muted">{localize(step.detail, loc)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Common problems */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">{t("problemsTitle")}</h2>
        <ul className="mt-3 space-y-2">
          {guide.commonProblems.map((p, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span className="text-sm text-ink">{localize(p, loc)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Support */}
      {guide.support ? (
        <section className="mt-6 rounded-lg border border-line bg-surface-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <LifeBuoy className="h-4 w-4 text-brand" /> {t("support")}
          </p>
          <p className="mt-1 text-sm text-muted">{localize(guide.support, loc)}</p>
        </section>
      ) : null}

      {/* Check my situation CTA */}
      <section className="mt-6 flex flex-col gap-2 sm:flex-row">
        <a
          href={guide.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
        >
          <CheckCircle2 className="h-4 w-4 text-success" />
          {t("checkSituation", { name: guide.name })}
        </a>
      </section>

      <p className="mt-8 text-xs text-subtle">{t("legalDisclaimer")}</p>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs font-semibold uppercase text-subtle">{label}</p>
      <p className="mt-1 text-sm text-muted">{value}</p>
    </div>
  );
}
