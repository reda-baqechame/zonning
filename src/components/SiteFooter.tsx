import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function SiteFooter() {
  const t = await getTranslations("legal");

  return (
    <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
      <p>
        ZONNING — Pipeline de revenus et conformité pour le Québec ·{" "}
        <span className="text-sky-500">Built with Cursor</span>
      </p>
      <nav className="mt-3 flex flex-wrap justify-center gap-4">
        <Link href="/verdict" className="hover:text-slate-300">
          PERMIS.AI
        </Link>
        <Link href="/terms" className="hover:text-slate-300">
          {t("footerTerms")}
        </Link>
        <Link href="/privacy" className="hover:text-slate-300">
          {t("footerPrivacy")}
        </Link>
        <Link href="/build-log" className="hover:text-slate-300">
          Build log
        </Link>
        <a
          href="/api/sync/health"
          className="hover:text-slate-300"
          target="_blank"
          rel="noopener noreferrer"
        >
          Data health
        </a>
      </nav>
    </footer>
  );
}
