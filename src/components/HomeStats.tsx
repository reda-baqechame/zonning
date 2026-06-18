"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export default function HomeStats() {
  const [stats, setStats] = useState<{
    permitsWeek: number;
    tendersOpen: number;
    companies: number;
    permitsLastSuccessAt?: string | null;
    datasetCount?: number;
    coverageCities?: number;
    cities?: string[];
  } | null>(null);

  useEffect(() => {
    fetch("/api/stats/public")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) return null;

  const freshness =
    stats.permitsLastSuccessAt &&
    formatDistanceToNow(new Date(stats.permitsLastSuccessAt), {
      addSuffix: true,
      locale: fr,
    });

  return (
    <div className="mx-auto max-w-5xl px-4">
      {freshness && (
        <p className="mb-4 text-center text-sm text-emerald-400">
          Permis mis à jour {freshness} · {stats.datasetCount ?? 33} jeux de données ·{" "}
          {stats.coverageCities ?? 10} villes
          {stats.cities && stats.cities.length > 0 && (
            <span className="block mt-1 text-xs text-slate-500">
              {stats.cities.join(" · ")}
            </span>
          )}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-3xl font-bold text-sky-300">{stats.permitsWeek}</p>
          <p className="text-sm text-slate-400">permis cette semaine</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-3xl font-bold text-sky-300">{stats.tendersOpen}</p>
          <p className="text-sm text-slate-400">appels SEAO ouverts</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
          <p className="text-3xl font-bold text-sky-300">{stats.companies.toLocaleString("fr-CA")}</p>
          <p className="text-sm text-slate-400">entreprises indexées</p>
        </div>
      </div>
    </div>
  );
}
