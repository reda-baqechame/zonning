"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { RBQ_LICENSE_CLASSES } from "@/lib/rbq";

const TRADES = ["plomberie", "électricité", "toiture", "mécanique", "commercial"];
const REGIONS = ["Ville-Marie", "Rosemont", "Laval", "Longueuil", "Québec"];

export default function OnboardingClient() {
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

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <p className="text-sm text-sky-400">ZONNING · Étape {step}/4</p>
      <h1 className="mt-2 text-2xl font-bold text-white">
        {step === 1 && "Votre licence RBQ"}
        {step === 2 && "Territoire et métiers"}
        {step === 3 && "Téléphone (alertes SMS)"}
        {step === 4 && "Marchés publics (AMP)"}
      </h1>

      {step === 1 && (
        <div className="mt-8 space-y-4">
          <select
            value={form.rbqLicenseClass}
            onChange={(e) => setForm({ ...form, rbqLicenseClass: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">Classe RBQ</option>
            {RBQ_LICENSE_CLASSES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.labelFr}
              </option>
            ))}
          </select>
          <input
            value={form.rbqLicenseNumber}
            onChange={(e) => setForm({ ...form, rbqLicenseNumber: e.target.value })}
            placeholder="Numéro de licence RBQ"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </div>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-6">
          <div>
            <p className="text-sm text-slate-400 mb-2">Métiers</p>
            <div className="flex flex-wrap gap-2">
              {TRADES.map((tr) => (
                <button
                  key={tr}
                  type="button"
                  onClick={() => toggle("trades", tr)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    form.trades.includes(tr) ? "bg-sky-500" : "bg-slate-800"
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-2">Régions</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle("regions", r)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    form.regions.includes(r) ? "bg-sky-500" : "bg-slate-800"
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
          <p className="text-sm text-slate-400">
            Optionnel — requis pour les alertes SMS (plan Pro+).
          </p>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="5145551234"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          />
        </div>
      )}

      {step === 4 && (
        <label className="mt-8 flex items-center gap-2 text-slate-300">
          <input
            type="checkbox"
            checked={form.ampAuthorized}
            onChange={(e) => setForm({ ...form, ampAuthorized: e.target.checked })}
          />
          Mon entreprise détient une autorisation de mise en marché (AMP) pour les marchés publics
        </label>
      )}

      <div className="mt-10 flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
          >
            Retour
          </button>
        )}
        {step < 4 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="rounded-lg bg-sky-500 px-6 py-2 text-sm font-medium"
          >
            Suivant
          </button>
        ) : (
          <button onClick={finish} className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-medium">
            Voir mon fil
          </button>
        )}
      </div>
    </div>
  );
}
