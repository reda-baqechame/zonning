"use client";

import { useState } from "react";
import {
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Download,
  FolderOpen,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const PRO_PLANS = new Set(["PRO", "EQUIPE"]);
const ESSENTIEL_PLUS = new Set(["ESSENTIEL", "PRO", "EQUIPE"]);

type SidebarUser = {
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
};

function initials(user?: SidebarUser | null) {
  const source = user?.name || user?.companyName || user?.email || "Z";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CockpitSidebar({
  plan,
  user,
}: {
  plan: string;
  user?: SidebarUser | null;
}) {
  const nav = useTranslations("nav");
  const t = useTranslations("feed.workspace");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const effectivePlan = user ? "EQUIPE" : plan;

  const primaryLinks = [
    { href: "/feed", label: locale === "fr" ? "Aujourd'hui" : "Today", icon: BriefcaseBusiness },
    { href: "/opportunity-brief", label: locale === "fr" ? "Dossiers" : "Dossiers", icon: FolderOpen },
    { href: "/passport", label: nav("passport"), icon: ShieldCheck },
    { href: "/vault", label: nav("vaultNav"), icon: FolderOpen },
    { href: "/guides", label: nav("guidesNav"), icon: BriefcaseBusiness },
  ];
  const utilityLinks = [
    { href: "/carte", label: nav("carte"), icon: MapPin },
    { href: "/coverage", label: nav("coverage"), icon: ChartNoAxesCombined },
    ...(PRO_PLANS.has(effectivePlan)
      ? [{ href: "/compliance", label: nav("compliance"), icon: ShieldCheck }]
      : []),
    ...(ESSENTIEL_PLUS.has(effectivePlan)
      ? [{ href: "/export", label: nav("export"), icon: Download }]
      : []),
  ];
  const navigation = (
    <>
      <div className="border-b border-line px-4 py-5">
        <Link href="/" prefetch={false} className="font-display text-xl font-bold text-ink">
          ZON<span className="text-brand">NING</span>
        </Link>
        <p className="mt-1 text-[10px] font-medium uppercase leading-4 text-subtle">
          {t("brandLine")}
        </p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label={nav("mainNavigation")}>
        <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-subtle">
          {locale === "fr" ? "Travail du jour" : "Daily work"}
        </p>
        {primaryLinks.map(({ href, label, icon: Icon }) => {
          const selected =
            pathname === href ||
            (href === "/feed" && pathname.startsWith("/feed")) ||
            (href === "/opportunity-brief" && pathname.startsWith("/opportunity-brief"));
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                selected
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-subtle">
          {locale === "fr" ? "Outils" : "Tools"}
        </p>
        {utilityLinks.map(({ href, label, icon: Icon }) => {
          const selected = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                selected
                  ? "bg-brand-soft text-brand"
                  : "text-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-2">
        <Link
          href="/settings"
          prefetch={false}
          className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted hover:bg-surface-hover hover:text-ink"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.6} />
          {nav("settings")}
        </Link>
        <div className="mt-1 flex items-center gap-3 px-3 py-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-hover text-xs font-semibold text-muted">
            {initials(user)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">
              {user?.name || user?.companyName || user?.email}
            </p>
            {user?.companyName && user.companyName !== user.name ? (
              <p className="truncate text-[11px] text-subtle">{user.companyName}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="text-[11px] font-medium text-subtle hover:text-ink"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = `/${locale}`;
            }}
          >
            {t("logoutShort")}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden h-screen w-48 shrink-0 flex-col border-r border-line bg-white lg:flex">
        {navigation}
      </aside>
      <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
        <Link href="/" prefetch={false} className="font-display text-lg font-bold text-ink">
          ZON<span className="text-brand">NING</span>
        </Link>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-md text-muted hover:bg-surface-hover"
          aria-label={nav("openMenu")}
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/20"
            aria-label={nav("closeMenu")}
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface-hover"
              aria-label={nav("closeMenu")}
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {navigation}
          </aside>
        </div>
      ) : null}
    </>
  );
}
