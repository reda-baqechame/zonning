"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Flame, TrendingUp, Clock } from "lucide-react";
import { formatCad } from "@/lib/format-cad";

type Pulse = {
  permitsWeek: number;
  permitsToday: number;
  highValueWeek: number;
  tendersClosingWeek: number;
  tendersClosingThursday: number;
  estimatedValueWeek: number;
  permitsLastSuccessAt: string | null;
  rgm?: { permitsToday: number; permitsWeek: number };
};

export default function MarketPulseBar({ compact }: { compact?: boolean }) {
  const t = useTranslations("fomo");
  const locale = useLocale();
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then(setPulse)
      .catch(() => {});
  }, []);

  if (!pulse) return null;
  const snapshotLabel = locale === "fr" ? "Données indexées" : "Indexed data";

  const items = [
    pulse.rgm &&
      pulse.rgm.permitsWeek > 0 && {
        icon: TrendingUp,
        text: t("pulseRgm", {
          count: pulse.rgm.permitsWeek,
          today: pulse.rgm.permitsToday,
        }),
        hot: pulse.rgm.permitsToday > 0,
      },
    pulse.permitsToday > 0 && {
      icon: TrendingUp,
      text: t("pulseToday", { count: pulse.permitsToday }),
      hot: true,
    },
    {
      icon: Flame,
      text: t("pulseHighValue", { count: pulse.highValueWeek }),
      hot: pulse.highValueWeek > 0,
    },
    pulse.tendersClosingThursday > 0 && {
      icon: Clock,
      text: t("pulseThursday", { count: pulse.tendersClosingThursday }),
      hot: true,
    },
    pulse.estimatedValueWeek > 0 && {
      icon: TrendingUp,
      text: t("pulseValue", { value: formatCad(pulse.estimatedValueWeek, locale) }),
      hot: false,
    },
    {
      icon: TrendingUp,
      text: t("pulseWeek", { count: pulse.permitsWeek }),
      hot: false,
    },
    pulse.tendersClosingWeek > 0 && {
      icon: Clock,
      text: t("pulseClosing", { count: pulse.tendersClosingWeek }),
      hot: pulse.tendersClosingWeek >= 5,
    },
  ].filter(Boolean) as { icon: typeof Flame; text: string; hot: boolean }[];

  if (compact) {
    const hot = items.find((i) => i.hot) ?? items[0];
    if (!hot) return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning-ink">
        <hot.icon className="h-3.5 w-3.5 shrink-0 text-warning" />
        <span className="truncate">{hot.text}</span>
        <span className="ml-auto shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning-ink">
          {snapshotLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-line bg-surface-2">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 bg-success-soft px-2.5 py-0.5 text-[10px] font-bold uppercase text-success-ink">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {snapshotLabel}
        </span>
        <div className="flex min-w-0 flex-1 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          {items.map((item, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 text-xs ${
                item.hot ? "font-semibold text-ink" : "text-muted"
              }`}
            >
              <item.icon className={`h-3.5 w-3.5 ${item.hot ? "text-brand" : "text-subtle"}`} />
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
