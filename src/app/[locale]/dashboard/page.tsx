import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { subDays, formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { getActiveDatasetIds, DATASETS, COVERAGE_CITIES, getDatasetCount } from "@/lib/datasets/registry";
import { computeStaleRatio, getDatasetStaleness } from "@/lib/sync/scheduler";
import { getLatestQualityByDataset } from "@/lib/sync/quality";
import { isSyncAutomationEnabled, getIntegrationStatus } from "@/lib/env";
import SyncDatasetButton from "@/components/SyncDatasetButton";
import AdminConciergePanel from "@/components/AdminConciergePanel";
import { isAdminEmail } from "@/lib/admin";

function datasetHealth(
  state: {
    lastSuccessAt: Date | null;
    status: string;
    lastError: string | null;
  } | undefined,
  refreshIntervalMinutes: number
): "healthy" | "stale" | "critical" | "syncing" | "never" {
  if (!state?.lastSuccessAt) return state?.status === "running" ? "syncing" : "never";
  if (state.status === "running") return "syncing";
  const ratio = computeStaleRatio(state.lastSuccessAt, refreshIntervalMinutes);
  if (ratio >= 2) return "critical";
  if (ratio >= 1) return "stale";
  return "healthy";
}

const HEALTH_STYLES = {
  healthy: "bg-emerald-500/20 text-emerald-300",
  stale: "bg-amber-500/20 text-amber-300",
  critical: "bg-red-500/20 text-red-300",
  syncing: "bg-sky-500/20 text-sky-300",
  never: "bg-slate-500/20 text-slate-300",
} as const;

export default async function DashboardPage({
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
  const admin = isAdminEmail(user.email);
  if (!admin) {
    redirect({ href: "/feed", locale });
    return null;
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const weekAgo = subDays(new Date(), 7);

  const [permitsWeek, tendersOpen, alerts, syncStates, payingAccounts, permitDelays, staleness, qualityMap, cityCoverage] =
    await Promise.all([
    prisma.permit.count({ where: { issueDate: { gte: weekAgo } } }),
    prisma.tender.count({
      where: {
        closesAt: { gte: new Date() },
        OR: [{ status: null }, { status: { not: "closed" } }],
      },
    }),
    prisma.alertSubscription.count({ where: { userId: user.id } }),
    prisma.syncState.findMany({ orderBy: { datasetId: "asc" } }),
    prisma.user.count({
      where: { plan: { in: ["ESSENTIEL", "PRO", "EQUIPE"] } },
    }),
    prisma.boroughPermitDelay.findMany({ orderBy: { borough: "asc" }, take: 20 }),
    getDatasetStaleness(),
    getLatestQualityByDataset(),
    Promise.all(
      COVERAGE_CITIES.map(async (city) => {
        const [count, mappable] = await Promise.all([
          prisma.permit.count({ where: { city } }),
          prisma.permit.count({
            where: { city, latitude: { not: null }, longitude: { not: null } },
          }),
        ]);
        return { city, count, mappable };
      })
    ),
  ]);

  const syncSummary = {
    healthy: 0,
    stale: 0,
    critical: 0,
    anomalies: 0,
  };
  for (const s of staleness) {
    const quality = qualityMap.get(s.datasetId);
    const hasAnomaly = quality?.status === "anomaly";
    if (hasAnomaly) syncSummary.anomalies++;
    else if (s.staleRatio >= 2) syncSummary.critical++;
    else if (s.stale) syncSummary.stale++;
    else syncSummary.healthy++;
  }
  const integrations = getIntegrationStatus();

  const dateLocale = locale === "fr" ? fr : enUS;
  const errorCount = syncStates.filter((s) => s.lastError || s.status === "error").length;
  const activeIds = getActiveDatasetIds();
  const healthyCount = activeIds.filter((id) => {
    const state = syncStates.find((s) => s.datasetId === id);
    return datasetHealth(state, DATASETS[id].refreshIntervalMinutes) === "healthy";
  }).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">
        {t("welcome")}, {user.name ?? user.email}
      </h1>
      <p className="mt-1 text-slate-400">
        {user.companyName} · {t("plan")}: {user.plan}
        {user.rbqVerified && " · ✓ RBQ vérifié"}
      </p>

      <div className="mt-6 rounded-xl border border-sky-800/40 bg-sky-950/20 p-4 text-sm text-slate-300">
        <p className="font-medium text-sky-200">
          Couverture données — {getDatasetCount()} jeux · {COVERAGE_CITIES.length} villes
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {healthyCount}/{activeIds.length} datasets sains · sync auto{" "}
          {isSyncAutomationEnabled() ? "activée" : "désactivée"}
        </p>
        <p className="mt-2 text-xs text-slate-500">{COVERAGE_CITIES.join(" · ")}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs text-slate-400">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="py-2 pr-4">Ville</th>
                <th className="py-2 pr-4">Permis</th>
                <th className="py-2">Carte</th>
              </tr>
            </thead>
            <tbody>
              {cityCoverage.map((row) => (
                <tr key={row.city} className="border-b border-slate-800/60">
                  <td className="py-2 pr-4 text-slate-300">{row.city}</td>
                  <td className="py-2 pr-4">{row.count}</td>
                  <td className="py-2">
                    {row.count > 0
                      ? `${Math.round((row.mappable / row.count) * 100)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Santé sync & intégrations</h2>
          <Link href="/api/sync/health" className="text-xs text-sky-400 hover:underline">
            /api/sync/health →
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-300">
            {syncSummary.healthy} sains
          </span>
          <span className="rounded-full bg-amber-500/20 px-3 py-1 text-amber-300">
            {syncSummary.stale} périmés
          </span>
          <span className="rounded-full bg-red-500/20 px-3 py-1 text-red-300">
            {syncSummary.critical} critiques
          </span>
          {syncSummary.anomalies > 0 && (
            <span className="rounded-full bg-fuchsia-500/20 px-3 py-1 text-fuchsia-300">
              {syncSummary.anomalies} anomalies
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className={integrations.resend ? "text-emerald-400" : "text-slate-500"}>
            Resend {integrations.resend ? "✓" : "—"}
          </span>
          <span className={integrations.stripe ? "text-emerald-400" : integrations.stripeDemo ? "text-amber-400" : "text-slate-500"}>
            Stripe {integrations.stripe ? "✓" : integrations.stripeDemo ? "demo" : "—"}
          </span>
          <span className={integrations.upstash ? "text-emerald-400" : "text-slate-500"}>
            Upstash {integrations.upstash ? "✓" : "—"}
          </span>
          <span className={integrations.twilio ? "text-emerald-400" : "text-slate-500"}>
            Twilio {integrations.twilio ? "✓" : "—"}
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <p className="text-sm text-slate-400">{t("permitsWeek")}</p>
          <p className="mt-2 text-3xl font-bold text-sky-300">{permitsWeek}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <p className="text-sm text-slate-400">{t("tendersOpen")}</p>
          <p className="mt-2 text-3xl font-bold text-sky-300">{tendersOpen}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <p className="text-sm text-slate-400">{t("alerts")}</p>
          <p className="mt-2 text-3xl font-bold text-sky-300">{alerts}</p>
        </div>
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-6">
          <p className="text-sm text-slate-400">Comptes payants</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{payingAccounts}</p>
          <a
            href="https://dashboard.stripe.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-emerald-400 hover:underline"
          >
            MRR → Stripe Dashboard
          </a>
        </div>
      </div>

      {permitDelays.length > 0 && (
        <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">Délais permis (Montréal)</h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {permitDelays.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-800 px-3 py-2 text-sm">
                <p className="font-medium text-slate-200">{d.borough}</p>
                <p className="text-xs text-slate-500">
                  {d.phase ?? "Permis"} — médiane {d.medianDays ?? "—"} j / cible{" "}
                  {d.targetDays ?? "—"} j
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t("dataFreshness")}</h2>
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">
              {errorCount} {t("syncErrors")}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {activeIds.map((id) => {
            const state = syncStates.find((s) => s.datasetId === id);
            const cfg = DATASETS[id];
            const label = cfg.label;
            const hasError = Boolean(state?.lastError || state?.status === "error");
            const health = datasetHealth(state, cfg.refreshIntervalMinutes);
            const ago = state?.lastSuccessAt
              ? formatDistanceToNow(state.lastSuccessAt, {
                  addSuffix: true,
                  locale: dateLocale,
                })
              : t("never");
            return (
              <div
                key={id}
                className={`rounded-lg border px-4 py-3 text-sm ${
                  hasError || health === "critical"
                    ? "border-red-500/40 bg-red-950/20"
                    : health === "stale"
                      ? "border-amber-500/30 bg-amber-950/10"
                      : "border-slate-800 bg-slate-900/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-200">{label}</p>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${HEALTH_STYLES[health]}`}
                  >
                    {health}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("lastSync")}: {ago}
                  {state?.recordsProcessed ? ` · ${state.recordsProcessed} rec.` : ""}
                </p>
                {(state?.syncOffset ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Reprise sync · offset {state?.syncOffset}
                  </p>
                )}
                {state?.lastError && (
                  <p className="mt-1 text-xs text-red-400 line-clamp-2">{state.lastError}</p>
                )}
                {admin && <SyncDatasetButton datasetId={id} label={id} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/feed", label: "Feed" },
          { href: "/chantier-radar", label: "ChantierRadar" },
          { href: "/marches-qc", label: "MarchésQC" },
          { href: "/partenaires-ca", label: "PartenairesCA" },
          { href: "/compliance", label: "Compliance Vault" },
          { href: "/concierge", label: "Concierge" },
          { href: "/paiement-public", label: "Paiement public" },
          { href: "/equipe", label: "Équipe" },
          { href: "/export", label: "Export CRM" },
        ].map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-slate-700 p-4 text-center font-medium text-white hover:border-sky-500"
          >
            {m.label} →
          </Link>
        ))}
      </div>

      {admin && <AdminConciergePanel />}
    </div>
  );
}
