export default function BuildLogPage() {
  const entries = [
    {
      week: "Semaine 14",
      title: "Enterprise + gap closure",
      items: [
        "PERMIS.AI geocoding — GTC, PUM 2050, LPC layers on Verdict share pages",
        "ChantierRadar: 10 villes, badges GTC/LPC, filtre type de permis",
        "Dashboard couverture SLA; verify-deploy 12 checks; GitHub crons complets",
        "Pipeline Score v2 + Verdict: projets résidentiels, délais permis, PUM2050 patrimoine",
      ],
    },
    {
      week: "Semaine 13",
      title: "Full Government Data Build",
      items: [
        "33 datasets — PUM 2050, GTC provincial, LPC heritage, permit delays",
        "Montreal CKAN + ArcGIS adapters; Sherbrooke, Trois-Rivières, Saguenay",
        "SEAO amendments, borough contracts, SiteIntelligence v2, coverage SLA",
        "Alert rules v2 (RBQ + noGtc), MarchésQC amendment badges, webhook filters",
      ],
    },
    {
      week: "Semaine 12",
      title: "Moat Hardening + GTM",
      items: [
        "22 datasets, quality gates, permit pagination, zoning hardening",
        "Signed sessions, Redis rate limits, Sentry, webhooks + verdict share",
        "HomeStats freshness, stats cron, CASL flag, Vitest + CI Postgres",
      ],
    },
    {
      week: "Semaine 11",
      title: "Industry Standard — ZONNING + PERMIS.AI",
      items: [
        "Feed Command Center (permis + contrats + verdict)",
        "PERMIS.AI public /verdict + share slugs + OG images",
        "Settings + onboarding wizard, permit AI summaries",
        "22 datasets, auto-sync, Équipe hub + admin Concierge",
      ],
    },
    {
      week: "Semaine 10",
      title: "Complete Build — Market Dominance",
      items: [
        "14 datasets sync (Montréal, Laval, Longueuil, RBQ, SEAO, Registre)",
        "Pipeline Score + RBQ verification live",
        "SMS Twilio + alertes jeudi SEAO",
        "Équipe: orgs, API v1, export CRM",
        "Concierge + paiement public + thermopompe funnel",
      ],
    },
    {
      week: "Semaine 8",
      title: "Gap Closure",
      items: [
        "Resend email alerts + plan gating",
        "SEAO awards + zoning lite",
        "Registre des entreprises + FreshnessBadge",
      ],
    },
    {
      week: "Semaine 1–6",
      title: "MVP Foundation",
      items: [
        "ChantierRadar, MarchésQC, PartenairesCA, Compliance Vault",
        "11 CKAN datasets + Vercel cron sync",
        "Stripe billing + bilingual FR/EN",
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm text-sky-400">ZONNING</p>
      <h1 className="mt-2 text-4xl font-bold text-white">Journal de construction ZONNING</h1>
      <p className="mt-4 text-slate-400">
        Pipeline de revenus et conformité pour le Québec — construit en public.
      </p>
      <div className="mt-12 space-y-10">
        {entries.map((e) => (
          <article key={e.week} className="border-l-2 border-sky-500/40 pl-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">{e.week}</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{e.title}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-400">
              {e.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
