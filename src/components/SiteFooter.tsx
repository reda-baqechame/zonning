import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { COVERAGE_CITIES, getDatasetCount } from "@/lib/datasets/registry";

export async function SiteFooter() {
  const t = await getTranslations("legal");
  const f = await getTranslations("footer");
  const cities = COVERAGE_CITIES.length;
  const datasets = getDatasetCount();

  return (
    <footer className="border-t border-slate-800 py-10">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <p className="text-sm text-slate-400">{f("tagline")}</p>
        <p className="mt-2 text-xs text-slate-600">
          {f("trust", { datasets, cities })}
        </p>
        <nav className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link href="/verdict" className="hover:text-slate-300">
            PERMIS.AI
          </Link>
          <Link href="/coverage" className="hover:text-slate-300">
            {f("coverage")}
          </Link>
          <Link href="/intelligence" className="hover:text-slate-300">
            {f("intelligence")}
          </Link>
          <Link href="/developers" className="hover:text-slate-300">
            {f("developers")}
          </Link>
          <Link href="/terms" className="hover:text-slate-300">
            {t("footerTerms")}
          </Link>
          <Link href="/privacy" className="hover:text-slate-300">
            {t("footerPrivacy")}
          </Link>
          <Link href="/build-log" className="hover:text-slate-300">
            {f("buildLog")}
          </Link>
          <Link href="/api/coverage/public" className="hover:text-slate-300">
            {f("coverageApi")}
          </Link>
          <a
            href="/api/sync/health"
            className="hover:text-slate-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            {f("dataHealth")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
