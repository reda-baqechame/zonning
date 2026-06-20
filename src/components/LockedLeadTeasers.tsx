"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";

type Teaser = {
  id: string;
  kind: "permit" | "tender";
  label: string;
  borough?: string | null;
  score: number;
  valueLabel?: string;
};

export default function LockedLeadTeasers({ teasers }: { teasers: Teaser[] }) {
  const t = useTranslations("fomo");
  const ts = useTranslations("leadSignals");

  if (teasers.length === 0) return null;

  return (
    <div className="mt-8 space-y-3">
      <p className="text-center text-sm font-medium text-muted">{t("lockedHeading")}</p>
      {teasers.map((teaser) => (
        <div
          key={teaser.id}
          className="relative overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-sm"
        >
          <div className="select-none blur-sm">
            <p className="font-semibold text-ink">{teaser.label}</p>
            <p className="text-sm text-muted">
              {teaser.borough ?? "Montréal"} · Score {teaser.score}
              {teaser.valueLabel ? ` · ${teaser.valueLabel}` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">
                {ts("rbq_eligible")}
              </span>
              <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">
                {ts("high_value")}
              </span>
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px]">
            <Lock className="h-5 w-5 text-warning" />
            <p className="text-xs font-medium text-muted">{t("lockedBody")}</p>
          </div>
        </div>
      ))}
      <div className="text-center">
        <Link href="/pricing">
          <Button variant="primary">{t("unlockCta")}</Button>
        </Link>
      </div>
    </div>
  );
}
