"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ShieldCheck,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Ban,
  ArrowRight,
  Loader2,
  Building2,
} from "lucide-react";
import type { GovernmentReadinessPassport } from "@/lib/domain/quebec";

export default function PassportClient({ dataMode }: { dataMode: string }) {
  const t = useTranslations("passport");
  const tCommon = useTranslations("nav");
  const [passport, setPassport] = useState<GovernmentReadinessPassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const locale = typeof window !== "undefined" && window.location.pathname.includes("/en") ? "en" : "fr";
    const controller = new AbortController();
    fetch(`/api/passport?locale=${locale}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load_failed"))))
      .then((data: { passport?: GovernmentReadinessPassport }) => {
        setPassport(data.passport ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "error");
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto flex max-w-5xl items-center justify-center px-4 py-20">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
        <span className="ml-2 text-sm text-muted">{t("loading")}</span>
      </main>
    );
  }

  if (error || !passport) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20">
        <p className="text-sm text-danger">{t("loadFailed")}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm hover:border-brand"
        >
          {t("retry")}
        </button>
      </main>
    );
  }

  const statusColor =
    passport.status === "ready"
      ? "text-success"
      : passport.status === "partial"
        ? "text-warning"
        : "text-danger";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <p className="flex items-center gap-2 text-xs font-medium uppercase text-subtle">
          <Building2 className="h-3.5 w-3.5" />
          {tCommon("opportunities")}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        <p className="mt-2 text-[11px] text-subtle">{t("dataMode", { mode: dataMode })}</p>
      </header>

      {/* Score header */}
      <section className="mb-6 border border-line bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-brand-soft">
              <span className="tabular-nums text-2xl font-bold text-ink">{passport.score}%</span>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-brand" />
                {t("statusLabel")}
              </p>
              <p className={`text-sm font-semibold ${statusColor}`}>
                {t(`status.${passport.status}`)}
              </p>
              <p className="mt-1 max-w-md text-sm text-muted">{passport.headline}</p>
            </div>
          </div>
        </div>

        {passport.blockers.length > 0 ? (
          <div className="mt-5 rounded-md border border-danger/30 bg-danger/5 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-danger">
              <Ban className="h-3.5 w-3.5" />
              {t("blockersLabel")}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {passport.blockers.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="text-danger">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* Ready / missing */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-subtle">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {t("ready")} ({passport.readyItems.length})
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {passport.readyItems.length === 0 ? (
              <li className="text-subtle">{t("empty")}</li>
            ) : (
              passport.readyItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="border border-line bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-subtle">
            <CircleAlert className="h-3.5 w-3.5 text-warning" />
            {t("missing")} ({passport.missingItems.length})
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {passport.missingItems.length === 0 ? (
              <li className="text-subtle">{t("noneMissing")}</li>
            ) : (
              passport.missingItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                  <span>{item}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      {/* Mission board */}
      <section className="mb-6 border border-line bg-white p-5">
        <h2 className="text-base font-semibold text-ink">{t("missionTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("missionSubtitle")}</p>
        <ol className="mt-4 space-y-2">
          {passport.missionBoard.map((task) => (
            <li
              key={task.id}
              className="flex items-start justify-between gap-3 rounded-md border border-line px-3 py-2.5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                  {task.step}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{task.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{task.detail}</p>
                  <p
                    className={`mt-1 text-[11px] font-semibold uppercase ${
                      task.status === "ready"
                        ? "text-success"
                        : task.status === "blocked"
                          ? "text-danger"
                          : task.status === "verify"
                            ? "text-warning"
                            : "text-subtle"
                    }`}
                  >
                    {t(`taskStatus.${task.status}`)}
                  </p>
                </div>
              </div>
              {task.href ? (
                <a
                  href={task.href}
                  target={task.href.startsWith("http") ? "_blank" : undefined}
                  rel={task.href.startsWith("http") ? "noreferrer" : undefined}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  {task.buttonLabel}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Next actions */}
      <section className="mb-6 border border-line bg-white p-5">
        <h2 className="text-base font-semibold text-ink">{t("nextActions")}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {passport.nextActions.map((action) => (
            <a
              key={action.id}
              href={action.href}
              target={action.href.startsWith("http") ? "_blank" : undefined}
              rel={action.href.startsWith("http") ? "noreferrer" : undefined}
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2.5 text-sm hover:border-brand"
            >
              <span>
                <span className="block font-semibold text-ink">{action.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{action.detail}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-brand">
                {action.buttonLabel}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Official sites */}
      <section className="border border-line bg-white p-5">
        <h2 className="text-base font-semibold text-ink">{t("officialSites")}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {passport.officialSites.map((site) => (
            <a
              key={site.id}
              href={site.href}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col rounded-md border border-line p-3 hover:border-brand"
            >
              <span className="flex items-center justify-between text-sm font-semibold text-ink">
                {site.label}
                <ExternalLink className="h-3.5 w-3.5 text-brand" />
              </span>
              <span className="mt-1 text-xs text-muted">{site.purpose}</span>
              <span className="mt-2 text-[11px] text-subtle">{site.accountRequired}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
