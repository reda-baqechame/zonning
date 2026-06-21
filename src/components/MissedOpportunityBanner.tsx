"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui";
import { formatCad } from "@/lib/format-cad";

export type FeedFomoMeta = {
  plan: string;
  poolPermits: number;
  poolHighValue: number;
  poolUrgentTenders: number;
  shownPermits: number;
  shownTenders: number;
  hiddenHighValue: number;
  hiddenUrgent: number;
  estimatedValueHidden: number;
};

export default function MissedOpportunityBanner({ meta }: { meta: FeedFomoMeta | null }) {
  const t = useTranslations("fomo");
  const locale = useLocale();

  if (!meta || meta.plan === "PRO" || meta.plan === "EQUIPE") return null;

  const hiddenPermits = Math.max(0, meta.poolPermits - meta.shownPermits);
  const hiddenTenders = Math.max(0, meta.poolUrgentTenders - meta.shownTenders);

  if (hiddenPermits < 5 && meta.hiddenHighValue < 1 && hiddenTenders < 2) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-soft p-5">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/5 blur-2xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-brand">
            <Zap className="h-5 w-5" />
            <h3 className="font-semibold text-ink">{t("missedTitle")}</h3>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-muted">
            {hiddenPermits > 0 && (
              <li>
                {t("missedPermits", { hidden: hiddenPermits, total: meta.poolPermits })}
              </li>
            )}
            {meta.hiddenHighValue > 0 && (
              <li className="font-medium text-brand-hover">
                {t("missedHighValue", { count: meta.hiddenHighValue })}
                {meta.estimatedValueHidden > 0 &&
                  ` · ${t("missedValue", { value: formatCad(meta.estimatedValueHidden, locale) })}`}
              </li>
            )}
            {hiddenTenders > 0 && (
              <li>{t("missedUrgent", { count: hiddenTenders })}</li>
            )}
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
            <Lock className="h-3 w-3" />
            {t("missedHint", { plan: meta.plan })}
          </p>
        </div>
        <Link href="/pricing" className="shrink-0">
          <Button variant="primary" size="md">
            {t("unlockCta")}
          </Button>
        </Link>
      </div>
    </div>
  );
}
