"use client";

import { CalendarClock, CircleCheckBig, SearchCheck, Target } from "lucide-react";
import { useTranslations } from "next-intl";

export type TriageFilter = "act_now" | "verify_first" | "watch" | null;

export function ContractorBriefing({
  actNow,
  verifyFirst,
  watch,
  due,
  activeFilter,
  onFilter,
}: {
  actNow: number;
  verifyFirst: number;
  watch: number;
  due: number;
  activeFilter: TriageFilter;
  onFilter: (filter: TriageFilter) => void;
}) {
  const t = useTranslations("feed.briefing");
  const decisions = [
    { id: "act_now" as const, value: actNow, label: t("actNow"), icon: Target },
    {
      id: "verify_first" as const,
      value: verifyFirst,
      label: t("verifyFirst"),
      icon: SearchCheck,
    },
    { id: "watch" as const, value: watch, label: t("watch"), icon: CircleCheckBig },
  ];

  return (
    <section className="mt-5 border-y border-line bg-white" aria-labelledby="daily-briefing-title">
      <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 id="daily-briefing-title" className="font-display text-lg font-semibold text-ink">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
          {decisions.map(({ id, value, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeFilter === id}
              onClick={() => onFilter(activeFilter === id ? null : id)}
              className={`min-w-32 bg-white px-4 py-3 text-left transition hover:bg-surface-hover ${
                activeFilter === id ? "shadow-[inset_0_-3px_0_var(--color-brand)]" : ""
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-muted">{label}</span>
                <Icon className="h-4 w-4 text-subtle" aria-hidden="true" />
              </span>
              <span className="mt-1 block font-display text-2xl font-semibold text-ink">{value}</span>
            </button>
          ))}
          <div className="min-w-32 bg-white px-4 py-3">
            <span className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted">{t("due")}</span>
              <CalendarClock className="h-4 w-4 text-subtle" aria-hidden="true" />
            </span>
            <span className={`mt-1 block font-display text-2xl font-semibold ${due > 0 ? "text-danger" : "text-ink"}`}>
              {due}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
