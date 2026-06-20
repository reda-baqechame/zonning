"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Check, CreditCard, LoaderCircle } from "lucide-react";
import { Button, FadeIn, PageHeader } from "@/components/ui";

const COPY = {
  fr: {
    title: "Forfaits ZONNING",
    subtitle:
      "Choisissez le niveau d'exploitation adapté à votre équipe. Le montant officiel et les conditions sont affichés dans Stripe avant tout paiement.",
    monthly: "Abonnement mensuel",
    oneTime: "Mandat unique",
    checkout: "Ouvrir le paiement sécurisé",
    notConfigured: "Non configuré",
    billingNotice: "Les forfaits non configurés restent désactivés; aucun paiement ni changement de forfait ne peut être simulé.",
    unavailable: "Le paiement n'est pas configuré pour ce forfait. Aucun changement n'a été effectué.",
    login: "Connectez-vous avant de choisir un forfait.",
    plans: {
      essentiel: ["Fil personnalisé", "Alertes courriel", "Résumé d'intelligence de site"],
      pro: ["Intelligence de site complète", "Compliance Vault", "Exports", "Alertes SMS configurables"],
      equipe: ["Fonctions Pro", "Jusqu'à 5 membres", "Clés API", "Webhooks"],
      concierge: ["Revue par analyste", "Opportunités qualifiées", "Livraison dans l'espace de travail"],
    },
  },
  en: {
    title: "ZONNING plans",
    subtitle:
      "Choose the operating level that fits your team. Stripe displays the authoritative amount and terms before any payment.",
    monthly: "Monthly subscription",
    oneTime: "One-time engagement",
    checkout: "Open secure checkout",
    notConfigured: "Not configured",
    billingNotice: "Unconfigured plans stay disabled; payment and plan changes are never simulated.",
    unavailable: "Billing is not configured for this plan. No change was made.",
    login: "Sign in before choosing a plan.",
    plans: {
      essentiel: ["Personalized feed", "Email alerts", "Site intelligence summary"],
      pro: ["Full site intelligence", "Compliance Vault", "Exports", "Configurable SMS alerts"],
      equipe: ["Pro features", "Up to 5 members", "API keys", "Webhooks"],
      concierge: ["Analyst review", "Qualified opportunities", "Workspace delivery"],
    },
  },
} as const;

const PLANS = [
  { id: "essentiel", name: "Essentiel", oneTime: false },
  { id: "pro", name: "Pro", oneTime: false },
  { id: "equipe", name: "Equipe", oneTime: false },
  { id: "concierge", name: "Concierge", oneTime: true },
] as const;

export default function PricingClient({
  configuredPlans,
}: {
  configuredPlans: Record<(typeof PLANS)[number]["id"], boolean>;
}) {
  const locale = useLocale() === "fr" ? "fr" : "en";
  const copy = COPY[locale];
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (plan: (typeof PLANS)[number]["id"]) => {
    setLoading(plan);
    setError(null);
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, locale }),
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    setLoading(null);

    if (response.status === 401) {
      setError(copy.login);
      window.location.assign(`/${locale}/login`);
      return;
    }
    if (!response.ok || !data.url) {
      setError(data.error ?? copy.unavailable);
      return;
    }
    window.location.assign(data.url);
  };

  return (
    <FadeIn className="mx-auto max-w-6xl px-4 py-12 text-ink">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />

      {!Object.values(configuredPlans).every(Boolean) && (
        <p className="mt-6 border-l-4 border-warning bg-warning-soft px-4 py-3 text-sm text-warning-ink">
          {copy.billingNotice}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-6 border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          {error}
        </p>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <section key={plan.id} className="flex min-h-[320px] flex-col rounded-lg border border-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <CreditCard className="h-5 w-5 text-brand" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm text-muted">{plan.oneTime ? copy.oneTime : copy.monthly}</p>
            <ul className="mt-6 flex-1 space-y-3 text-sm text-muted">
              {copy.plans[plan.id].map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="mt-6 w-full"
              disabled={loading !== null || !configuredPlans[plan.id]}
              onClick={() => checkout(plan.id)}
            >
              {loading === plan.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {configuredPlans[plan.id] ? copy.checkout : copy.notConfigured}
            </Button>
          </section>
        ))}
      </div>
    </FadeIn>
  );
}
