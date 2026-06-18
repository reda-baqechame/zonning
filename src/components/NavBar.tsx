"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";

export function NavBar({
  user,
}: {
  user?: { name?: string | null; email: string; plan?: string } | null;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();

  const links = [
    ...(user ? [{ href: "/feed", label: t("feed") }] : []),
    ...(user?.plan === "EQUIPE" ? [{ href: "/equipe", label: "Équipe" }] : []),
    { href: "/verdict", label: t("verdict") },
    { href: "/chantier-radar", label: t("chantierRadar") },
    { href: "/marches-qc", label: t("marchesQc") },
    { href: "/partenaires-ca", label: t("partenairesCa") },
    { href: "/compliance", label: t("compliance") },
    { href: "/pricing", label: t("pricing") },
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          ZON<span className="text-sky-400">NING</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white transition">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/"
            locale={locale === "fr" ? "en" : "fr"}
            className="text-slate-400 hover:text-white"
          >
            {locale === "fr" ? "EN" : "FR"}
          </Link>
          {user ? (
            <>
              <Link href="/feed" className="text-slate-300 hover:text-white">
                {t("feed")}
              </Link>
              <Link href="/settings" className="text-slate-400 hover:text-white">
                {t("settings")}
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  onClick={async (e) => {
                    e.preventDefault();
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = `/${locale}`;
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  {t("logout")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-slate-300 hover:text-white">
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-white hover:bg-sky-400"
              >
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
