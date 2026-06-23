import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { COVERAGE_CITIES, getDatasetCount } from "@/lib/datasets/registry";

export async function SiteFooter() {
  const t = await getTranslations("legal");
  const f = await getTranslations("footer");
  const n = await getTranslations("nav");
  const registeredSources = getDatasetCount();

  return (
    <footer className="border-t border-line bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <p className="text-sm text-muted">{f("tagline")}</p>
        <p className="mt-2 text-xs text-subtle">
          {f("trustTruth", {
            indexed: registeredSources,
            sources: registeredSources,
            searchable: COVERAGE_CITIES.length,
            monitored: COVERAGE_CITIES.length,
          })}
        </p>
        <nav className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/" prefetch={false} className="hover:text-brand">
            {n("search")}
          </Link>
          <Link href="/verdict" prefetch={false} className="hover:text-brand">
            {n("dossier")}
          </Link>
          <Link href="/carte" prefetch={false} className="hover:text-brand">
            {n("carte")}
          </Link>
          <Link href="/partenaires-ca" prefetch={false} className="hover:text-brand">
            {n("companies")}
          </Link>
          <Link href="/coverage" prefetch={false} className="hover:text-brand">
            {f("coverage")}
          </Link>
          <Link href="/terms" prefetch={false} className="hover:text-brand">
            {t("footerTerms")}
          </Link>
          <Link href="/privacy" prefetch={false} className="hover:text-brand">
            {t("footerPrivacy")}
          </Link>
          <a href="/api/v2/coverage" className="hover:text-brand" target="_blank" rel="noopener noreferrer">
            {f("coverageApi")}
          </a>
          <a
            href="/api/sync/health"
            className="hover:text-brand"
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
