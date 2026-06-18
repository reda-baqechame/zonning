"use client";

import type { VerdictTier } from "@/lib/verdict/compute-verdict";

const TIER_STYLES: Record<
  VerdictTier,
  { ring: string; bg: string; text: string }
> = {
  eleve: { ring: "border-emerald-500", bg: "bg-emerald-950/40", text: "text-emerald-300" },
  moyen: { ring: "border-amber-500", bg: "bg-amber-950/40", text: "text-amber-300" },
  faible: { ring: "border-slate-500", bg: "bg-slate-900/60", text: "text-slate-300" },
  bloque: { ring: "border-red-500", bg: "bg-red-950/40", text: "text-red-300" },
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
      className={`relative rounded-2xl border-2 ${s.ring} ${s.bg} p-6 text-center ${compact ? "p-4" : ""}`}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">PERMIS.AI</p>
      <p className={`mt-2 text-2xl font-bold ${s.text} ${compact ? "text-lg" : ""}`}>{label}</p>
      <p className="mt-3 text-sm text-slate-400 line-clamp-2">{address}</p>
      <div className="mt-4 flex justify-center">
        <div className={`h-16 w-16 rounded-full border-4 ${s.ring} flex items-center justify-center`}>
          <span className="text-2xl">✓</span>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-slate-600">Analyse PERMIS.AI · Propulsé par ZONNING</p>
    </div>
  );
}
