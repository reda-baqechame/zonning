"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";
import {
  Input,
  Select,
  FieldLabel,
  Button,
  FadeIn,
} from "@/components/ui";

const TRADES = ["plomberie", "électricité", "toiture", "mécanique", "commercial"];
const REGIONS = ["Ville-Marie", "Rosemont", "Laval", "Longueuil", "Québec"];
const STEPS = ["stepProfile", "stepTrades", "stepPhone", "stepAmp"] as const;

export default function OnboardingClient() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [step, setStep] = useState(1);
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
    await fetch("/api/user/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, onboardingComplete: true }),
    });
    router.push("/feed");
  };

  const stepTitle =
    step === 1 ? t("stepProfile") : step === 2 ? t("stepTrades") : step === 3 ? t("stepPhone") : t("stepAmp");

  return (
    <FadeIn className="mx-auto max-w-lg px-4 py-16">
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm text-slate-400">
          <span>{t("subtitle", { step, total: 4 })}</span>
          <span>{step}/4</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-sky-500 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {STEPS.map((key, i) => (
            <span
              key={key}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                i + 1 === step
                  ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/40"
                  : i + 1 < step
                    ? "bg-slate-800 text-slate-400"
                    : "bg-slate-900 text-slate-600"
              }`}
            >
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-bold text-white">{stepTitle}</h1>

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
            <p className="mb-2 text-sm font-medium text-slate-300">{t("trades")}</p>
            <div className="flex flex-wrap gap-2">
              {TRADES.map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => toggle("trades", tr)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    form.trades.includes(tr)
                      ? "bg-sky-500 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-300">{t("regions")}</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle("regions", r)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    form.regions.includes(r)
                      ? "bg-sky-500 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
          <p className="text-sm text-slate-400">{t("phoneHint")}</p>
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
        <label className="mt-8 flex items-start gap-3 text-slate-300">
          <input
            type="checkbox"
            checked={form.ampAuthorized}
            onChange={(e) => setForm({ ...form, ampAuthorized: e.target.checked })}
            className="mt-1 rounded border-slate-600"
          />
          <span className="text-sm">{t("amp")}</span>
        </label>
      )}

      <div className="mt-10 flex gap-3">
        {step > 1 && (
          <Button variant="secondary" onClick={() => setStep(step - 1)}>
            {t("back")}
          </Button>
        )}
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)}>{t("next")}</Button>
        ) : (
          <Button variant="primary" className="bg-emerald-600 hover:bg-emerald-500" onClick={finish}>
            {t("finish")}
          </Button>
        )}
      </div>
    </FadeIn>
  );
}
