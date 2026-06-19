import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getDatasetCount, COVERAGE_CITIES } from "@/lib/datasets/registry";
import HomeStats from "@/components/HomeStats";
import MarketPulseBar from "@/components/MarketPulseBar";
import QuebecCoverageBar from "@/components/QuebecCoverageBar";
import OpportunityPreview from "@/components/OpportunityPreview";
import { HomeFeatureGrid } from "@/components/HomeFeatureGrid";
import { Settings, Bell, Shield } from "lucide-react";

export default async function HomePage() {
  const t = await getTranslations("hero");
  const heroBadge = t("badge", {
    datasets: getDatasetCount(),
    cities: COVERAGE_CITIES.length,
  });

  const steps = [
    { icon: Settings, title: t("step1Title"), desc: t("step1Desc") },
    { icon: Bell, title: t("step2Title"), desc: t("step2Desc") },
    { icon: Shield, title: t("step3Title"), desc: t("step3Desc") },
  ];

  const comparisons = [
    { them: "Munera", us: "RBQ-Fit vérifié + SEAO + CASL" },
    { them: "MERX / SEAO", us: "Alertes jeudi + résumés en français" },
    { them: "Apollo / ZoomInfo", us: "Données publiques québécoises, conformes CASL" },
  ];

  return (
    <div>
      <MarketPulseBar />
      <QuebecCoverageBar />
      <section className="mx-auto max-w-7xl px-4 py-16 text-center md:py-24">
        <span className="mb-4 inline-block rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1 text-sm font-medium text-sky-300">
          {heroBadge}
        </span>
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white md:text-5xl lg:text-6xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
          {t("subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-sky-500 px-8 py-3 font-semibold text-white transition hover:bg-sky-400"
          >
            {t("cta")}
          </Link>
          <Link
            href="/verdict"
            className="rounded-xl border border-emerald-600/50 bg-emerald-950/20 px-8 py-3 font-semibold text-emerald-300 transition hover:border-emerald-400"
          >
            {t("ctaVerdict")}
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/pricing" className="text-slate-400 hover:text-sky-400">
            {t("ctaSecondary")} →
          </Link>
          <Link href="/coverage" className="text-slate-400 hover:text-sky-400">
            {t("coverageCta")} →
          </Link>
          <Link href="/digest" className="text-slate-400 hover:text-sky-400">
            {t("digestCta")} →
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-900/30 py-14">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500">
            {t("howItWorks")}
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sky-400">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xs font-medium text-sky-500">0{i + 1}</p>
                <h3 className="mt-2 font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16 pt-12">
        <HomeStats />
      </section>

      <OpportunityPreview />

      <HomeFeatureGrid />

      <section className="border-t border-slate-800 bg-slate-900/20 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold text-white">{t("whyTitle")}</h2>
          <div className="mt-8 space-y-3">
            {comparisons.map((c) => (
              <div
                key={c.them}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="text-sm text-slate-500">{c.them}</span>
                  <span className="text-sm font-medium text-slate-200">{c.us}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
