"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";
import SiteIntelligencePanel, { intelAccessForPlan } from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import { Button, Input, FieldLabel, Select } from "@/components/ui";

export default function IntelligenceExplorerClient() {
  const t = useTranslations("intelExplorer");
  const locale = useLocale();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Montréal");
  const [borough, setBorough] = useState("");
  const [intel, setIntel] = useState<PropertyIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ address: address.trim() });
      if (city) params.set("city", city);
      if (borough) params.set("borough", borough);
      const res = await fetch(`/api/intelligence?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setIntel(data.intelligence ?? data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setIntel(null);
    } finally {
      setLoading(false);
    }
  }

  const access = intelAccessForPlan("PRO");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white">{t("title")}</h1>
      <p className="mt-2 text-slate-400">{t("subtitle")}</p>

      <div className="mt-8 space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div>
          <FieldLabel>{t("address")}</FieldLabel>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("addressPlaceholder")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>{t("city")}</FieldLabel>
            <Select value={city} onChange={(e) => setCity(e.target.value)}>
              {COVERAGE_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>{t("borough")}</FieldLabel>
            <Input
              value={borough}
              onChange={(e) => setBorough(e.target.value)}
              placeholder={t("boroughOptional")}
            />
          </div>
        </div>
        <Button onClick={lookup} disabled={loading}>
          {loading ? t("loading") : t("search")}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {intel && (
        <div className="mt-8">
          <SiteIntelligencePanel intel={intel} locale={locale} access={access} />
        </div>
      )}
    </div>
  );
}
