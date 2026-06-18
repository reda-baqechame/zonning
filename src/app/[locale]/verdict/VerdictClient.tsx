"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";

export default function VerdictClient() {
  const t = useTranslations("verdict");
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [borough, setBorough] = useState("");
  const [city, setCity] = useState("Montréal");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setLoading(true);
    const res = await fetch("/api/verdict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address,
        borough: borough || undefined,
        city: city || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Erreur");
      return;
    }
    router.push(`/verdict/${data.report.shareSlug}`);
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <p className="text-center text-sm uppercase tracking-widest text-emerald-400">PERMIS.AI</p>
      <h1 className="mt-2 text-center text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-3 text-center text-slate-400">{t("subtitle")}</p>

      <form onSubmit={submit} className="mt-10 space-y-4">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t("addressPlaceholder")}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
          required
        />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
        >
          {COVERAGE_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={borough}
          onChange={(e) => setBorough(e.target.value)}
          placeholder={t("boroughPlaceholder")}
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "..." : t("cta")}
        </button>
      </form>

      <p className="mt-8 text-center text-xs text-slate-600">{t("footer")}</p>
    </div>
  );
}
