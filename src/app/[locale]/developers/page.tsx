import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getDatasetCount, COVERAGE_CITIES } from "@/lib/datasets/registry";

export default async function DevelopersPage() {
  const t = await getTranslations("developers");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-slate-400">{t("subtitle")}</p>

      <section className="mt-10 space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="font-semibold text-white">{t("restTitle")}</h2>
          <p className="mt-2 text-sm text-slate-400">{t("restDesc")}</p>
          <ul className="mt-4 space-y-2 font-mono text-sm text-sky-300">
            <li>GET /api/v1/permits</li>
            <li>GET /api/v1/tenders</li>
            <li>GET /api/v1/verdict?address=...</li>
            <li>GET /api/v1/intelligence?address=... (Équipe)</li>
          </ul>
          <p className="mt-4 text-xs text-slate-500">{t("authNote")}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <h2 className="font-semibold text-white">{t("publicTitle")}</h2>
          <ul className="mt-4 space-y-2 font-mono text-sm text-emerald-300">
            <li>GET /api/stats/public</li>
            <li>GET /api/coverage/public</li>
          </ul>
        </div>

        <p className="text-sm text-slate-500">
          {t("coverage", {
            datasets: getDatasetCount(),
            cities: COVERAGE_CITIES.length,
          })}
        </p>

        <Link href="/coverage" className="text-sky-400 hover:underline">
          {t("coverageLink")} →
        </Link>
      </section>
    </div>
  );
}
