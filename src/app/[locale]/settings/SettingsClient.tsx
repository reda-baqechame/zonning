"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";

const TRADE_OPTIONS = [
  "plomberie",
  "électricité",
  "toiture",
  "mécanique",
  "béton",
  "charpente",
  "excavation",
  "commercial",
];

const REGION_OPTIONS = [
  "Ville-Marie",
  "Rosemont",
  "Ahuntsic",
  "Laval",
  "Longueuil",
  "Québec",
  "Montréal",
];

export default function SettingsClient() {
  const t = useTranslations("settings");
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    rbqLicenseClass: "",
    rbqLicenseNumber: "",
    phone: "",
    ampAuthorized: false,
    alertSmsEnabled: false,
    minProjectCost: "",
    maxProjectCost: "",
    trades: [] as string[],
    regions: [] as string[],
  });
  const [rbqVerified, setRbqVerified] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plan, setPlan] = useState("FREE");
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        if (!u) return;
        setPlan(u.plan ?? "FREE");
        setStripeCustomerId(u.stripeCustomerId ?? null);
        setRbqVerified(u.rbqVerified ?? false);
        setForm({
          name: u.name ?? "",
          companyName: u.companyName ?? "",
          rbqLicenseClass: u.rbqLicenseClass ?? "",
          rbqLicenseNumber: u.rbqLicenseNumber ?? "",
          phone: u.phone ?? "",
          ampAuthorized: u.ampAuthorized ?? false,
          alertSmsEnabled: u.alertSmsEnabled ?? false,
          minProjectCost: u.minProjectCost?.toString() ?? "",
          maxProjectCost: u.maxProjectCost?.toString() ?? "",
          trades: u.trades ? JSON.parse(u.trades) : [],
          regions: u.regions ? JSON.parse(u.regions) : [],
        });
      });
  }, []);

  const toggle = (key: "trades" | "regions", value: string) => {
    setForm((f) => {
      const arr = f[key];
      return {
        ...f,
        [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  };

  const save = async (onboarding = false) => {
    const res = await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        minProjectCost: form.minProjectCost ? parseFloat(form.minProjectCost) : null,
        maxProjectCost: form.maxProjectCost ? parseFloat(form.maxProjectCost) : null,
        onboardingComplete: onboarding,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error ?? "Erreur");
      return;
    }
    const d = await res.json();
    setRbqVerified(d.user?.rbqVerified ?? false);
    setSaved(true);
    if (onboarding) router.push("/feed");
  };

  const openBillingPortal = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        globalThis.location.assign(data.url);
      } else {
        alert(data.error ?? "Erreur");
      }
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-slate-400">{t("subtitle")}</p>

      {stripeCustomerId && plan !== "FREE" && (
        <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-sm text-slate-300">
            {t("currentPlan")}: <span className="font-medium text-white">{plan}</span>
          </p>
          <button
            type="button"
            onClick={openBillingPortal}
            disabled={billingLoading}
            className="mt-3 rounded-lg border border-sky-600 px-4 py-2 text-sm text-sky-300 hover:border-sky-400 disabled:opacity-50"
          >
            {billingLoading ? "…" : t("manageSubscription")}
          </button>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">{t("company")}</h2>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("name")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            placeholder={t("companyName")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">RBQ</h2>
          <select
            value={form.rbqLicenseClass}
            onChange={(e) => setForm({ ...form, rbqLicenseClass: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {RBQ_LICENSE_CLASSES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.labelFr}
              </option>
            ))}
          </select>
          <input
            value={form.rbqLicenseNumber}
            onChange={(e) => setForm({ ...form, rbqLicenseNumber: e.target.value })}
            placeholder={t("rbqNumber")}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          {rbqVerified && <p className="text-sm text-emerald-400">{t("rbqVerified")}</p>}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">{t("trades")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRADE_OPTIONS.map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => toggle("trades", tr)}
                className={`rounded-full px-3 py-1 text-xs ${
                  form.trades.includes(tr) ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white">{t("regions")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggle("regions", r)}
                className={`rounded-full px-3 py-1 text-xs ${
                  form.regions.includes(r) ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.ampAuthorized}
              onChange={(e) => setForm({ ...form, ampAuthorized: e.target.checked })}
            />
            {t("amp")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.alertSmsEnabled}
              onChange={(e) => setForm({ ...form, alertSmsEnabled: e.target.checked })}
            />
            {t("smsAlerts")}
          </label>
        </section>

        <div className="flex gap-3">
          <button
            onClick={() => save(false)}
            className="rounded-lg bg-sky-500 px-6 py-2 text-sm font-medium text-white hover:bg-sky-400"
          >
            {t("save")}
          </button>
          <button
            onClick={() => save(true)}
            className="rounded-lg border border-emerald-600 px-6 py-2 text-sm text-emerald-300 hover:border-emerald-400"
          >
            {t("saveAndFeed")}
          </button>
        </div>
        {saved && <p className="text-sm text-emerald-400">{t("saved")}</p>}
      </div>
    </div>
  );
}
