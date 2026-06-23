import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { buildRuntimeTruth, type CoverageStatus } from "@/lib/runtime-truth";

const STATUS_STYLES: Record<CoverageStatus, string> = {
  LIVE_INDEXED: "bg-emerald-500/20 text-emerald-300",
  PARTIAL_INDEXED: "bg-sky-500/20 text-sky-300",
  DOCUMENT_ONLY: "bg-amber-500/20 text-amber-300",
  REGISTERED_NOT_SYNCED: "bg-slate-500/20 text-slate-300",
  COMING_SOON: "bg-violet-500/20 text-violet-300",
  BROKEN: "bg-red-500/20 text-red-300",
};

function StatusBadge({ status }: { status: CoverageStatus }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-600">{sub}</p>}
    </div>
  );
}

export default async function RuntimeTruthPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (!isAdminEmail(user.email)) {
    redirect({ href: "/feed", locale });
    return null;
  }

  const t = await buildRuntimeTruth();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">Runtime truth</h1>
      <p className="mt-2 text-sm text-slate-400">
        Ce que ZONNING peut réellement servir maintenant — calculé en direct depuis la base de
        données, le registre et la santé de synchronisation. Pas de chiffres marketing.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Sources répertoriées" value={t.registeredSources} />
        <Stat label="Jeux indexés" value={t.indexedDatasets} sub="avec données ingérées" />
        <Stat label="Villes avec permis" value={`${t.searchableMunicipalities}/${t.monitoredCities}`} sub="recherchables / surveillées" />
        <Stat label="Permis (cartographiables)" value={t.totalPermits.toLocaleString()} sub={`${t.mappablePermits.toLocaleString()} sur la carte`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Appels d'offres" value={t.totalTenders.toLocaleString()} />
        <Stat
          label="Santé sync"
          value={t.syncHealth.ok ? "OK" : "DÉGRADÉE"}
          sub={`${t.syncHealth.healthy} sain · ${t.syncHealth.stale} obsolète · ${t.syncHealth.critical} critique`}
        />
        <Stat label="PostGIS" value={t.postgisEnabled ? "activé" : "désactivé"} sub={t.databaseProvider} />
        <Stat label="Mode cron" value={t.deploymentCronMode} />
      </div>

      {(t.criticalDatasets.length > 0 || t.staleDatasets.length > 0) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {t.criticalDatasets.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-sm font-medium text-red-300">Jeux critiques ({t.criticalDatasets.length})</p>
              <p className="mt-1 break-words text-xs text-slate-400">{t.criticalDatasets.join(", ")}</p>
            </div>
          )}
          {t.staleDatasets.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-amber-300">Jeux obsolètes ({t.staleDatasets.length})</p>
              <p className="mt-1 break-words text-xs text-slate-400">{t.staleDatasets.join(", ")}</p>
            </div>
          )}
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold text-white">Couverture par ville</h2>
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Ville</th>
              <th className="px-3 py-2">Permis</th>
              <th className="px-3 py-2">Permis</th>
              <th className="px-3 py-2">Carte</th>
              <th className="px-3 py-2">Zonage</th>
              <th className="px-3 py-2">Points zonage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {t.cities.map((c) => (
              <tr key={c.city} className="text-slate-300">
                <td className="px-3 py-2 font-medium text-white">{c.city}</td>
                <td className="px-3 py-2"><StatusBadge status={c.permitStatus} /></td>
                <td className="px-3 py-2 font-mono text-slate-400">{c.permitCount.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-slate-400">{c.mappablePercent}%</td>
                <td className="px-3 py-2"><StatusBadge status={c.zoningStatus} /></td>
                <td className="px-3 py-2 font-mono text-slate-400">{c.zoningPoints.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-600">
        Mis à jour {new Date(t.updatedAt).toLocaleString(locale === "fr" ? "fr-CA" : "en-CA")} · JSON :{" "}
        <code className="text-slate-500">/api/admin/runtime-truth</code>
      </p>
    </div>
  );
}
