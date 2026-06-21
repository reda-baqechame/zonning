"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";
import {
  PageHeader,
  Input,
  Select,
  FieldLabel,
  Button,
  Badge,
  useToast,
  FadeIn,
} from "@/components/ui";

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
  ...COVERAGE_CITIES,
];

export default function SettingsClient() {
  const t = useTranslations("settings");
  const c = useTranslations("common");
  const { success, error: toastError } = useToast();
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
  const [integrations, setIntegrations] = useState<{
    resend?: boolean;
    twilio?: boolean;
    stripe?: boolean;
    stripeDisabled?: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        const u = d.user;
        if (!u) return;
        setIntegrations(d.integrations ?? null);
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
      toastError(d.error ?? c("error"));
      return;
    }
    const d = await res.json();
    setRbqVerified(d.user?.rbqVerified ?? false);
    setSaved(true);
    success(t("saved"));
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
        toastError(data.error ?? c("error"));
      }
    } finally {
      setBillingLoading(false);
    }
  };

  return (
    <FadeIn className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {stripeCustomerId && plan !== "FREE" && (
        <div className="mt-6 rounded-lg border border-line bg-surface-2 p-4">
          <p className="text-sm text-muted">
            {t("currentPlan")}: <span className="font-medium text-ink">{plan}</span>
          </p>
          <Button type="button" onClick={openBillingPortal} disabled={billingLoading} variant="secondary">
            {billingLoading ? "…" : t("manageSubscription")}
          </Button>
        </div>
      )}

      {integrations && (
        <div className="mt-6 rounded-lg border border-line bg-surface-2 p-4 text-sm text-muted">
          <p className="font-medium text-ink">{t("integrations")}</p>
          <ul className="mt-2 space-y-1">
            <li>Courriel (Resend): {integrations.resend ? "✓" : "—"}</li>
            <li>SMS (Twilio): {integrations.twilio ? "✓" : "—"}</li>
            <li>Stripe: {integrations.stripe ? "✓" : "désactivé"}</li>
          </ul>
        </div>
      )}

      <div className="mt-8 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">{t("company")}</h2>
          <div>
            <FieldLabel htmlFor="name">{t("name")}</FieldLabel>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="companyName">{t("companyName")}</FieldLabel>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">RBQ</h2>
          <div>
            <FieldLabel htmlFor="rbqClass">{t("rbqClass")}</FieldLabel>
            <Select
              id="rbqClass"
              value={form.rbqLicenseClass}
              onChange={(e) => setForm({ ...form, rbqLicenseClass: e.target.value })}
            >
              <option value="">—</option>
              {RBQ_LICENSE_CLASSES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.labelFr}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="rbqNumber">{t("rbqNumber")}</FieldLabel>
            <Input
              id="rbqNumber"
              value={form.rbqLicenseNumber}
              onChange={(e) => setForm({ ...form, rbqLicenseNumber: e.target.value })}
            />
          </div>
          {rbqVerified && (
            <Badge variant="success">{t("rbqVerified")}</Badge>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">{t("trades")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRADE_OPTIONS.map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => toggle("trades", tr)}
                className={`rounded-full px-3 py-1 text-xs ${
                  form.trades.includes(tr) ? "bg-brand text-brand-ink" : "bg-surface-hover text-muted"
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">{t("regions")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {REGION_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => toggle("regions", r)}
                className={`rounded-full px-3 py-1 text-xs ${
                  form.regions.includes(r) ? "bg-brand text-brand-ink" : "bg-surface-hover text-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.ampAuthorized}
              onChange={(e) => setForm({ ...form, ampAuthorized: e.target.checked })}
            />
            {t("amp")}
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={form.alertSmsEnabled}
              onChange={(e) => setForm({ ...form, alertSmsEnabled: e.target.checked })}
            />
            {t("smsAlerts")}
          </label>
        </section>

        <div className="flex gap-3">
          <Button onClick={() => save(false)}>{t("save")}</Button>
          <Button variant="success" onClick={() => save(true)}>
            {t("saveAndFeed")}
          </Button>
        </div>
        {saved && <p className="text-sm text-success-ink">{t("saved")}</p>}
      </div>
    </FadeIn>
  );
}
