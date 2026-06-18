"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";

export default function ThermopompeClient() {
  const [surface, setSurface] = useState(1500);
  const [email, setEmail] = useState("");
  const rebate = Math.round(surface * 0.8 * 12);

  const capture = async () => {
    if (!email) return;
    await fetch("/api/digest/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, trade: "chauffage", borough: "Laval" }),
    });
    alert("Digest HVAC envoyé chaque semaine!");
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold text-white">Calculateur thermopompe QC</h1>
      <p className="mt-3 text-slate-400">
        Estimez vos rabais — puis recevez les permis HVAC de votre région via ZONNING.
      </p>
      <label className="mt-8 block text-sm text-slate-400">Superficie (pi²)</label>
      <input
        type="range"
        min={800}
        max={4000}
        value={surface}
        onChange={(e) => setSurface(parseInt(e.target.value))}
        className="mt-2 w-full"
      />
      <p className="mt-4 text-2xl font-bold text-emerald-300">
        Rabais estimé: ~{rebate.toLocaleString("fr-CA")} $ / an
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Courriel pour digest permis HVAC"
        className="mt-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
      />
      <button
        type="button"
        onClick={capture}
        className="mt-4 w-full rounded-xl bg-sky-500 py-3 font-semibold hover:bg-sky-400"
      >
        Recevoir les permis chauffage
      </button>
      <Link href="/pricing" className="mt-6 block text-center text-sm text-sky-400">
        Passer à ChantierRadar Essentiel →
      </Link>
    </div>
  );
}
