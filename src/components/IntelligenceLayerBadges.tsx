import type { PropertyIntelligence, SiteIntelligenceLayers } from "@/lib/intelligence";

type Props = {
  intel: PropertyIntelligence;
  locale?: string;
};

const LAYER_LABELS: Record<keyof SiteIntelligenceLayers, { fr: string; en: string }> = {
  gtc: { fr: "GTC provincial", en: "Provincial GTC" },
  lpc: { fr: "LPC protégé", en: "LPC protected" },
  pum2050: { fr: "PUM 2050", en: "PUM 2050" },
  regionalZoning: { fr: "Zonage régional", en: "Regional zoning" },
};

export default function IntelligenceLayerBadges({ intel, locale = "fr" }: Props) {
  const layers = intel.layers ?? {};
  const active = (Object.keys(LAYER_LABELS) as (keyof SiteIntelligenceLayers)[]).filter(
    (k) => layers[k]
  );

  if (active.length === 0 && !intel.contamination?.gtcNearby && !intel.heritage?.lpcProtected) {
    return null;
  }

  const en = locale === "en";

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {active.map((key) => (
        <span
          key={key}
          className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-200"
        >
          {en ? LAYER_LABELS[key].en : LAYER_LABELS[key].fr}
        </span>
      ))}
      {intel.contamination?.gtcNearby && !layers.gtc && (
        <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">
          {en ? "GTC contamination" : "Contamination GTC"}
        </span>
      )}
      {intel.heritage?.pum2050Listed && (
        <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-300">
          {en ? "PUM 2050 heritage" : "Patrimoine PUM 2050"}
        </span>
      )}
      {intel.developmentProjects?.nearby && (
        <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
          {en ? "Nearby dev projects" : "Projets résidentiels à proximité"}
        </span>
      )}
      {intel.permitDelays?.medianDays != null && (
        <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs text-slate-300">
          {en ? "Permit delays" : "Délais permis"}: {intel.permitDelays.medianDays}j
        </span>
      )}
    </div>
  );
}
