import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { buildPublicRuntimeSummary } from "@/lib/runtime-truth";

export async function SiteFooter() {
  const t = await getTranslations("legal");
  const f = await getTranslations("footer");
  // Truth-aligned numbers computed from the live DB — not hardcoded marketing.
  const truth = await buildPublicRuntimeSummary().catch(() => null);

  return (
    <footer className="border-t border-slate-800 py-10">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <p className="text-sm text-slate-400">{f("tagline")}</p>
        {truth && (
          <p className="mt-2 text-xs text-slate-600">
            {f("trustTruth", {
              indexed: truth.indexedDatasets,
              sources: truth.registeredSources,
              searchable: truth.searchableMunicipalities,
              monitored: truth.monitoredCities,
            })}
          </p>
        )}
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
