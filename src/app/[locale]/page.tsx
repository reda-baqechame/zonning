import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { getDatasetCount, COVERAGE_CITIES } from "@/lib/datasets/registry";
import HomeStats from "@/components/HomeStats";

export default async function HomePage() {
  const t = await getTranslations();
  const heroBadge = `${getDatasetCount()} jeux de données · ${COVERAGE_CITIES.length} villes`;

  const features = [
    { key: "chantier", href: "/chantier-radar", icon: "📡" },
    { key: "marches", href: "/marches-qc", icon: "🏛️" },
    { key: "partenaires", href: "/partenaires-ca", icon: "🤝" },
    { key: "compliance", href: "/compliance", icon: "🛡️" },
  ] as const;

  const comparisons = [
    { them: "Munera", us: "RBQ-Fit vérifié + SEAO + CASL" },
    { them: "MERX / SEAO", us: "Alertes jeudi + résumés IA en français" },
    { them: "Apollo / ZoomInfo", us: "Données publiques québécoises, conformes CASL" },
  ];

  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 py-20 text-center">
        <span className="mb-4 inline-block rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1 text-sm text-sky-300">
          {heroBadge}
        </span>
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white md:text-6xl">
          {t("hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
          {t("hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/feed"
            className="rounded-xl bg-sky-500 px-8 py-3 font-semibold text-white hover:bg-sky-400"
          >
            {t("hero.cta")}
          </Link>
          <Link
            href="/verdict"
            className="rounded-xl border border-emerald-600/50 px-8 py-3 font-semibold text-emerald-300 hover:border-emerald-400"
          >
            {t("hero.ctaVerdict")}
          </Link>
          <Link
            href="/pricing"
            className="rounded-xl border border-slate-600 px-8 py-3 font-semibold text-slate-200 hover:border-slate-400"
          >
            {t("hero.ctaDemo")}
          </Link>
          <Link
            href="/digest"
            className="rounded-xl border border-emerald-600/50 px-8 py-3 font-semibold text-emerald-300 hover:border-emerald-400"
          >
            Digest gratuit
          </Link>
        </div>
      </section>

      <section className="pb-16">
        <HomeStats />
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 md:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <Link
            key={f.key}
            href={f.href}
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 hover:border-sky-500/50 transition"
          >
            <span className="text-3xl">{f.icon}</span>
            <h3 className="mt-4 text-lg font-semibold text-white">
              {t(`features.${f.key}.title`)}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              {t(`features.${f.key}.desc`)}
            </p>
          </Link>
        ))}
      </section>

      <section className="border-t border-slate-800 bg-slate-900/30 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="text-center text-2xl font-bold text-white">Pourquoi ZONNING?</h2>
          <div className="mt-8 space-y-4">
            {comparisons.map((c) => (
              <div
                key={c.them}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 p-4 md:flex-row md:items-center md:justify-between"
              >
                <span className="text-slate-500">{c.them}</span>
                <span className="text-sky-300">→ {c.us}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-white">{t("cursorCase.title")}</h2>
          <p className="mt-4 text-slate-400">{t("cursorCase.desc")}</p>
          <Link
            href="/build-log"
            className="mt-6 inline-block text-sm text-sky-400 hover:text-sky-300"
          >
            {t("beta.title")} → build log
          </Link>
        </div>
      </section>

      <section className="border-t border-slate-800 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-bold text-white">{t("beta.title")}</h2>
          <p className="mt-3 text-slate-400">{t("beta.desc")}</p>
          <Link
            href="/build-log"
            className="mt-6 inline-block text-sm text-sky-400 hover:text-sky-300"
          >
            Built with Cursor — voir le journal de construction →
          </Link>
        </div>
      </section>
    </div>
  );
}
