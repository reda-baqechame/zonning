"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";

const PRO_PLANS = new Set(["PRO", "EQUIPE"]);
const ESSENTIEL_PLUS = new Set(["ESSENTIEL", "PRO", "EQUIPE"]);

function NavLink({
  href,
  label,
  pathname,
  onClick,
}: {
  href: string;
  label: string;
  pathname: string;
  onClick?: () => void;
}) {
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-slate-800 font-medium text-white"
          : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
      )}
    >
      {label}
    </Link>
  );
}

export function NavBar({
  user,
}: {
  user?: { name?: string | null; email: string; plan?: string } | null;
}) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const plan = user?.plan ?? "FREE";

  const links = [
    ...(user
      ? [{ href: "/feed", label: t("feed") }]
      : [{ href: "/feed-preview", label: t("feedPreview") }]),
    { href: "/verdict", label: t("verdict") },
    { href: "/intelligence", label: t("intelligence") },
    { href: "/carte", label: t("carte") },
    { href: "/chantier-radar", label: t("chantierRadar") },
    { href: "/marches-qc", label: t("marchesQc") },
    { href: "/coverage", label: t("coverage") },
    { href: "/partenaires-ca", label: t("partenairesCa") },
    ...(user ? [{ href: "/paiement-public", label: t("paiementPublic") }] : []),
    ...(PRO_PLANS.has(plan) ? [{ href: "/compliance", label: t("compliance") }] : []),
    ...(ESSENTIEL_PLUS.has(plan) ? [{ href: "/export", label: t("export") }] : []),
    ...(plan === "EQUIPE" ? [{ href: "/equipe", label: t("equipe") }] : []),
    { href: "/pricing", label: t("pricing") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          ZON<span className="text-sky-400">NING</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} />
          ))}
        </nav>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            locale={locale === "fr" ? "en" : "fr"}
            className="hidden rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-white sm:inline"
          >
            {locale === "fr" ? "EN" : "FR"}
          </Link>

          {user ? (
            <div className="hidden items-center gap-1 md:flex">
              <NavLink href="/settings" label={t("settings")} pathname={pathname} />
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = `/${locale}`;
                }}
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {t("logout")}
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className="rounded-lg px-3 py-2 text-slate-300 hover:text-white">
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-white hover:bg-sky-400"
              >
                {t("register")}
              </Link>
            </div>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(100%,320px)] flex-col bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="font-semibold text-white">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Mobile">
              {links.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  pathname={pathname}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
              <div className="my-2 border-t border-slate-800" />
              <Link
                href="/"
                locale={locale === "fr" ? "en" : "fr"}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-slate-400"
              >
                {locale === "fr" ? "English" : "Français"}
              </Link>
              {user ? (
                <>
                  <NavLink href="/settings" label={t("settings")} pathname={pathname} onClick={() => setMobileOpen(false)} />
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      window.location.href = `/${locale}`;
                    }}
                  >
                    {t("logout")}
                  </Button>
                </>
              ) : (
                <>
                  <NavLink href="/login" label={t("login")} pathname={pathname} onClick={() => setMobileOpen(false)} />
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    <Button className="mt-2 w-full">{t("register")}</Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
