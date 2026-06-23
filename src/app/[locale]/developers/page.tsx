import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { COVERAGE_CITIES, getDatasetCount } from "@/lib/datasets/registry";

const PRIVATE_ENDPOINTS = [
  "GET /api/v2/sites/{id}",
  "GET /api/v2/sites/{id}/zoning",
  "GET /api/v2/sites/{id}/constraints",
  "GET /api/v2/sites/{id}/permits",
  "GET /api/v2/opportunities",
  "POST /api/v2/reports",
  "GET /api/v1/permits",
  "GET /api/v1/tenders",
  "GET /api/v1/verdict?address=...",
  "GET /api/v1/site-review?address=...",
];

const PUBLIC_ENDPOINTS = [
  "GET /api/v2/search",
  "GET /api/v2/coverage",
  "POST /api/v2/reports/email",
  "GET /api/stats/public",
  "GET /api/coverage/public",
];

export default async function DevelopersPage() {
  const t = await getTranslations("developers");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 text-ink">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand">ZONNING Data/API</p>
      <h1 className="mt-3 text-3xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("subtitle")}</p>

      <section className="mt-10 grid gap-6">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-ink">{t("restTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">{t("restDesc")}</p>
            </div>
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              Scoped keys required
            </span>
          </div>
          <ul className="mt-5 grid gap-2 font-mono text-sm text-brand md:grid-cols-2">
            {PRIVATE_ENDPOINTS.map((endpoint) => (
              <li key={endpoint} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                {endpoint}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-subtle">{t("authNote")}</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="font-semibold text-ink">Signed workspace endpoint</h2>
          <p className="mt-2 text-sm text-muted">
            Alert creation uses the signed browser session because subscriptions belong to an individual workspace user.
          </p>
          <p className="mt-4 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-brand">
            POST /api/v2/alerts
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="font-semibold text-ink">{t("publicTitle")}</h2>
          <p className="mt-2 text-sm text-muted">
            Public endpoints expose coverage and health proof only; paid datasets stay behind scoped customer access.
          </p>
          <ul className="mt-4 grid gap-2 font-mono text-sm text-success sm:grid-cols-2">
            {PUBLIC_ENDPOINTS.map((endpoint) => (
              <li key={endpoint} className="rounded-lg border border-line bg-success-soft px-3 py-2">
                {endpoint}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <p className="text-sm text-muted">
            {t("coverage", {
              datasets: getDatasetCount(),
              cities: COVERAGE_CITIES.length,
            })}
          </p>
          <Link href="/coverage" className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline">
            {t("coverageLink")} →
          </Link>
        </div>
      </section>
    </div>
  );
}
