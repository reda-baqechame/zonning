"use client";

import { useState } from "react";

export default function DigestClient() {
  const [email, setEmail] = useState("");
  const [borough, setBorough] = useState("");
  const [trade, setTrade] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/digest/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, borough, trade }),
    });
    if (res.ok) setDone(true);
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <h1 className="text-3xl font-bold text-white">Digest hebdomadaire gratuit</h1>
      <p className="mt-3 text-slate-400">
        Recevez les permis de votre arrondissement chaque semaine — sans compte.
      </p>
      {done ? (
        <p className="mt-8 text-emerald-400">Inscription confirmée!</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Courriel"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
          />
          <input
            value={borough}
            onChange={(e) => setBorough(e.target.value)}
            placeholder="Arrondissement (ex. Ville-Marie)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
          />
          <input
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            placeholder="Métier (ex. électricité)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-sky-500 py-3 font-semibold hover:bg-sky-400"
          >
            S&apos;inscrire
          </button>
        </form>
      )}
    </div>
  );
}
