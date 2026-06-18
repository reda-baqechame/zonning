"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";

const plans = [
  {
    id: "essentiel",
    key: "essentiel",
    price: 199,
    features: [
      "ChantierRadar — 1 métier, 1 région",
      "5 appels d'offres SEAO / semaine",
      "Alertes courriel",
    ],
  },
  {
    id: "pro",
    key: "pro",
    price: 349,
    popular: true,
    features: [
      "Alertes illimitées ChantierRadar",
      "MarchésQC complet",
      "Score RBQ-Fit",
      "Compliance Vault",
    ],
  },
  {
    id: "equipe",
    key: "equipe",
    price: 699,
    features: [
      "Tout Pro + 5 sièges",
      "Export API",
      "Support prioritaire",
    ],
  },
  {
    id: "concierge",
    key: "concierge",
    price: 2500,
    oneTime: true,
    features: [
      "Appel stratégie 1-on-1",
      "50 opportunités qualifiées",
      "Configuration initiale",
    ],
  },
] as const;

export default function PricingClient() {
  const t = useTranslations("pricing");
  const router = useRouter();
  const locale = useLocale();

  const checkout = async (planId: string) => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, locale }),
    });
    const data = await res.json();
    if (data.url) {
      globalThis.location.assign(data.url);
    } else if (data.demo) {
      alert(data.message);
      router.push("/feed");
    } else if (data.error) alert(data.error);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white">{t("title")}</h1>
        <p className="mt-3 text-slate-400">{t("subtitle")}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-6 ${
              "popular" in plan && plan.popular
                ? "border-sky-500 bg-sky-500/5"
                : "border-slate-800 bg-slate-900/40"
            }`}
          >
            <h2 className="text-lg font-semibold text-white">
              {t(plan.key as "essentiel")}
            </h2>
            <p className="mt-4">
              <span className="text-4xl font-bold text-white">{plan.price}$</span>
              <span className="text-slate-400">
                {"oneTime" in plan && plan.oneTime ? ` ${t("oneTime")}` : t("perMonth")}
              </span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-400">
              {plan.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
            <button
              onClick={() => checkout(plan.id)}
              className={`mt-8 w-full rounded-lg py-2.5 text-sm font-semibold ${
                "popular" in plan && plan.popular
                  ? "bg-sky-500 text-white hover:bg-sky-400"
                  : "border border-slate-600 text-slate-200 hover:border-slate-400"
              }`}
            >
              {"oneTime" in plan && plan.oneTime ? t("contact") : t("subscribe")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
