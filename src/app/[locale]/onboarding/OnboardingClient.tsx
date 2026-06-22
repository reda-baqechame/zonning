"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";
import { Button, FadeIn, FieldError, FieldLabel, Input, Select } from "@/components/ui";

const TRADES = ["plomberie", "électricité", "toiture", "mécanique", "commercial"];
const REGIONS = ["Ville-Marie", "Rosemont", "Laval", "Longueuil", "Québec"];
const STEPS = ["stepProfile", "stepTrades", "stepPhone", "stepAmp"] as const;

export default function OnboardingClient() {
  const t = useTranslations("onboarding");
  const c = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    rbqLicenseClass: "",
    rbqLicenseNumber: "",
    trades: [] as string[],
    regions: [] as string[],
    phone: "",
    ampAuthorized: false,
  });

  const toggle = (key: "trades" | "regions", v: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }));
  };

  const finish = async () => {
    if (saving) return;
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, onboardingComplete: true }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? c("error"));
        return;
      }

      router.push("/feed");
    } catch {
      setError(c("error"));
    } finally {
      setSaving(false);
    }
  };

  const stepTitle =
    step === 1 ? t("stepProfile") : step === 2 ? t("stepTrades") : step === 3 ? t("stepPhone") : t("stepAmp");

  return (
    <FadeIn className="mx-auto max-w-xl px-4 py-16 text-ink">
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{t("subtitle", { step, total: 4 })}</span>
            <span>{step}/4</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {STEPS.map((key, i) => (
              <span
                key={key}
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  i + 1 === step
                    ? "bg-brand-soft text-brand ring-1 ring-brand-border"
                    : i + 1 < step
                      ? "bg-success-soft text-success"
                      : "bg-surface-2 text-subtle"
                }`}
              >
                {t(key)}
              </span>
            ))}
          </div>
        </div>

        <h1 className="text-2xl font-bold text-ink">{stepTitle}</h1>
        <p className="mt-2 text-sm text-muted">
          Configurez votre territoire, vos métiers et vos alertes pour que ZONNING filtre les opportunités utiles dès le premier jour.
        </p>

        {step === 1 && (
          <div className="mt-8 space-y-4">
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
                placeholder={t("rbqNumber")}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-8 space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium text-ink">{t("trades")}</p>
              <div className="flex flex-wrap gap-2">
                {TRADES.map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => toggle("trades", tr)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      form.trades.includes(tr)
                        ? "bg-brand text-white"
                        : "border border-line bg-surface text-muted hover:border-brand-border hover:text-brand"
                    }`}
                  >
                    {tr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink">{t("regions")}</p>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggle("regions", r)}
                    className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                      form.regions.includes(r)
                        ? "bg-brand text-white"
                        : "border border-line bg-surface text-muted hover:border-brand-border hover:text-brand"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-muted">{t("phoneHint")}</p>
            <div>
              <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="5145551234"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <label className="mt-8 flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-4 text-muted">
            <input
              type="checkbox"
              checked={form.ampAuthorized}
              onChange={(e) => setForm({ ...form, ampAuthorized: e.target.checked })}
              className="mt-1 rounded border-line accent-brand"
            />
            <span className="text-sm">{t("amp")}</span>
          </label>
        )}

        <FieldError message={error} />

        <div className="mt-10 flex gap-3">
          {step > 1 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={saving}>
              {t("back")}
            </Button>
          )}
          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={saving}>
              {t("next")}
            </Button>
          ) : (
            <Button
              variant="primary"
              className="bg-success hover:bg-emerald-600"
              onClick={finish}
              disabled={saving}
            >
              {saving ? c("loading") : t("finish")}
            </Button>
          )}
        </div>
      </div>
    </FadeIn>
  );
}
