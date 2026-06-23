"use client";

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import type { PublicUser } from "@/lib/user-dto";

const PRO_PLANS = new Set(["PRO", "EQUIPE"]);
const ESSENTIEL_PLUS = new Set(["ESSENTIEL", "PRO", "EQUIPE"]);

type NavItem = {
  href: string;
  label: string;
  desktop?: boolean;
};

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
  const active =
    pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      prefetch={false}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-brand-soft font-medium text-brand"
          : "text-muted hover:bg-surface-hover hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}

export function NavBar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((payload: { user?: PublicUser | null }) => setUser(payload.user ?? null))
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  if (
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname.startsWith("/opportunity-brief")
  )
    return null;

  const plan = user ? "EQUIPE" : "FREE";

  const links: NavItem[] = [
    { href: "/", label: t("search") },
    { href: "/verdict", label: t("dossier") },
    { href: user ? "/feed" : "/feed-preview", label: t("opportunities") },
    ...(user
      ? [
          { href: "/triage", label: t("triage") },
          { href: "/passport", label: t("passport") },
          { href: "/vault", label: t("vaultNav") },
        ]
      : []),
    { href: "/chantier-radar", label: t("chantierRadar") },
    { href: "/carte", label: t("carte") },
    { href: "/guides", label: t("guidesNav") },
    { href: "/coverage?view=municipalities", label: t("municipalities"), desktop: false },
    { href: "/partenaires-ca", label: t("companies"), desktop: false },
    { href: "/coverage", label: t("coverage") },
    ...(PRO_PLANS.has(plan)
      ? [{ href: "/compliance", label: t("compliance") }]
      : []),
    ...(ESSENTIEL_PLUS.has(plan)
      ? [{ href: "/export", label: t("export") }]
      : []),
    ...(plan === "EQUIPE" ? [{ href: "/equipe", label: t("equipe") }] : []),
  ];
  const desktopLinks = links.filter((link) => link.desktop !== false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" prefetch={false} className="shrink-0 text-xl font-bold tracking-tight text-ink">
          ZON<span className="text-brand">NING</span>
          <span className="ml-1 align-super text-[10px] font-semibold text-brand">
            Québec
          </span>
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex"
          aria-label={t("mainNavigation")}
        >
          {desktopLinks.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              label={l.label}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          <Link
            href="/"
            locale={locale === "fr" ? "en" : "fr"}
            prefetch={false}
            className="hidden rounded-lg px-2 py-1.5 text-muted hover:bg-surface-hover hover:text-ink sm:inline"
          >
            {locale === "fr" ? "EN" : "FR"}
          </Link>

          {user ? (
            <div className="hidden items-center gap-1 md:flex">
              <NavLink
                href="/settings"
                label={t("settings")}
                pathname={pathname}
              />
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = `/${locale}`;
                }}
                className="rounded-lg px-3 py-2 text-muted hover:bg-surface-hover hover:text-ink"
              >
                {t("logout")}
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                prefetch={false}
                className="rounded-lg px-3 py-2 text-muted hover:text-ink"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                prefetch={false}
                className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white shadow-sm hover:bg-brand-hover"
              >
                {t("createWorkspace")}
              </Link>
            </div>
          )}

          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-surface-hover xl:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <div
            className="absolute inset-0 bg-slate-900/25"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(100%,320px)] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-semibold text-ink">{t("menu")}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-muted hover:bg-surface-hover"
                aria-label={t("closeMenu")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
              aria-label={t("mobileNavigation")}
            >
              {links.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  pathname={pathname}
                  onClick={() => setMobileOpen(false)}
                />
              ))}
              <div className="my-2 border-t border-line" />
              <Link
                href="/"
                locale={locale === "fr" ? "en" : "fr"}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-muted"
              >
                {locale === "fr" ? "English" : "Français"}
              </Link>
              {user ? (
                <>
                  <NavLink
                    href="/settings"
                    label={t("settings")}
                    pathname={pathname}
                    onClick={() => setMobileOpen(false)}
                  />
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
                  <NavLink
                    href="/login"
                    label={t("login")}
                    pathname={pathname}
                    onClick={() => setMobileOpen(false)}
                  />
                  <Link href="/register" prefetch={false} onClick={() => setMobileOpen(false)}>
                    <Button className="mt-2 w-full">
                      {t("createWorkspace")}
                    </Button>
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
