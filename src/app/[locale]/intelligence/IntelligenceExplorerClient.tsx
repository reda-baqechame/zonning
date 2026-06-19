"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Search, MapPin, History } from "lucide-react";
import { COVERAGE_CITIES } from "@/lib/datasets/registry";
import SiteIntelligencePanel, { intelAccessForPlan } from "@/components/SiteIntelligencePanel";
import type { PropertyIntelligence } from "@/lib/intelligence";
import { Button, Input, FieldLabel, Select, EmptyState } from "@/components/ui";

const RECENTS_KEY = "zonning:intel:recents";

/** Curated showcase parcels that always return a full report (see seed). */
const EXAMPLES: { address: string; city: string }[] = [
  { address: "1500 rue Wellington", city: "Montréal" },
  { address: "4200 rue Rachel Est", city: "Montréal" },
  { address: "500 rue de la Couronne", city: "Québec" },
  { address: "800 rue Lucien-Paiement", city: "Laval" },
  { address: "1200 avenue Panama", city: "Brossard" },
];

export default function IntelligenceExplorerClient({ plan = "FREE" }: { plan?: string }) {
  const t = useTranslations("intelExplorer");
  const locale = useLocale();
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Montréal");
  const [borough, setBorough] = useState("");
  const [intel, setIntel] = useState<PropertyIntelligence | null>(null);
  const [hasData, setHasData] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    // Read persisted recents only after mount to avoid an SSR hydration
    // mismatch (server has no localStorage).
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setRecents(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  function pushRecent(value: string) {
    setRecents((prev) => {
      const next = [value, ...prev.filter((r) => r !== value)].slice(0, 6);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function lookup(over?: { address: string; city?: string }) {
    const addr = (over?.address ?? address).trim();
    if (!addr) return;
    const useCity = over?.city ?? city;
    setAddress(addr);
    if (over?.city) setCity(over.city);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ address: addr });
      if (useCity) params.set("city", useCity);
      if (!over && borough) params.set("borough", borough);
      const res = await fetch(`/api/intelligence?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setIntel(data.intelligence ?? null);
      setHasData(data.hasData ?? Boolean(data.intelligence));
      pushRecent(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setIntel(null);
      setHasData(null);
    } finally {
      setLoading(false);
    }
  }

  const access = intelAccessForPlan(plan);

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
            onKeyDown={(e) => e.key === "Enter" && lookup()}
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
        <Button onClick={() => lookup()} disabled={loading}>
          {loading ? t("loading") : t("search")}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("examples")}
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.address}
                type="button"
                onClick={() => lookup(ex)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-500/60 hover:text-white"
              >
                <MapPin className="h-3 w-3" />
                {ex.address}
              </button>
            ))}
          </div>
        </div>

        {recents.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500">
              <History className="h-3 w-3" />
              {t("recentSearches")}
            </p>
            <div className="flex flex-wrap gap-2">
              {recents.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => lookup({ address: r })}
                  className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400 transition hover:text-white"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasData && intel && (
        <div className="mt-8">
          <SiteIntelligencePanel intel={intel} locale={locale} access={access} />
        </div>
      )}

      {hasData === false && (
        <div className="mt-8">
          <EmptyState
            icon={<Search className="h-8 w-8" />}
            title={t("noDataTitle")}
            description={t("noDataDescription")}
          />
        </div>
      )}
    </div>
  );
}
