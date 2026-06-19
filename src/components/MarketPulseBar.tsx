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
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
        <hot.icon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span className="truncate">{hot.text}</span>
        <span className="ml-auto shrink-0 animate-pulse rounded-full bg-amber-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
          {t("live")}
        </span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-r from-slate-950 via-sky-950/40 to-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(14,165,233,0.08)_0%,_transparent_70%)]" />
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {t("live")}
        </span>
        <div className="flex min-w-0 flex-1 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none">
          {items.map((item, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 text-xs ${
                item.hot ? "font-medium text-amber-200" : "text-slate-400"
              }`}
            >
              <item.icon className={`h-3.5 w-3.5 ${item.hot ? "text-amber-400" : "text-sky-500"}`} />
              {item.text}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
