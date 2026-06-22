"use client";

import type { VerdictTier } from "@/lib/verdict/compute-verdict";

const TIER_STYLES: Record<
  VerdictTier,
  { ring: string; bg: string; text: string; mark: string }
> = {
  insufficient_data: {
    ring: "border-slate-300",
    bg: "bg-surface-2",
    text: "text-subtle",
    mark: "?",
  },
  eleve: {
    ring: "border-success",
    bg: "bg-success-soft",
    text: "text-success",
    mark: "✓",
  },
  moyen: {
    ring: "border-warning",
    bg: "bg-warning-soft",
    text: "text-warning",
    mark: "!",
  },
  faible: {
    ring: "border-slate-300",
    bg: "bg-surface-2",
    text: "text-muted",
    mark: "•",
  },
  bloque: {
    ring: "border-danger",
    bg: "bg-danger-soft",
    text: "text-danger",
    mark: "×",
  },
};

export default function VerdictStamp({
  tier,
  label,
  address,
  compact,
}: {
  tier: VerdictTier;
  label: string;
  address: string;
  compact?: boolean;
}) {
  const s = TIER_STYLES[tier];
  return (
    <div
      className={`relative rounded-2xl border-2 ${s.ring} ${s.bg} p-6 text-center shadow-sm ${compact ? "p-4" : ""}`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-subtle">ZONNING verdict</p>
      <p className={`mt-2 text-2xl font-bold ${s.text} ${compact ? "text-lg" : ""}`}>{label}</p>
      <p className="mt-3 line-clamp-2 text-sm text-muted">{address}</p>
      <div className="mt-4 flex justify-center">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full border-4 bg-white ${s.ring}`}>
          <span className={`text-2xl font-bold ${s.text}`}>{s.mark}</span>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-subtle">Sourced analysis · limitations shown when data is missing</p>
    </div>
  );
}
