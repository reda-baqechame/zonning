import type { PropertyIntelligence, SiteIntelligenceLayers } from "@/lib/intelligence";

type Props = {
  intel: PropertyIntelligence;
  locale?: string;
};

const LAYER_LABELS: Record<keyof SiteIntelligenceLayers, { fr: string; en: string }> = {
  gtc: { fr: "Entrée GTC à proximité", en: "GTC entry nearby" },
  lpc: { fr: "Site LPC à proximité", en: "LPC site nearby" },
  pum2050: { fr: "PUM 2050", en: "PUM 2050" },
  regionalZoning: { fr: "Signal de zonage régional", en: "Regional zoning signal" },
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
          className="rounded-full border border-brand-border bg-brand-soft px-3 py-1 text-xs font-medium text-brand"
        >
          {en ? LAYER_LABELS[key].en : LAYER_LABELS[key].fr}
        </span>
      ))}
      {intel.contamination?.gtcNearby && !layers.gtc && (
        <span className="rounded-full border border-danger/20 bg-danger-soft px-3 py-1 text-xs text-danger-ink">
          {en ? "GTC entry nearby" : "Entrée GTC à proximité"}
        </span>
      )}
      {intel.heritage?.pum2050Listed && (
        <span className="rounded-full border border-warning/20 bg-warning-soft px-3 py-1 text-xs text-warning-ink">
          {en ? "PUM 2050 heritage" : "Patrimoine PUM 2050"}
        </span>
      )}
      {intel.developmentProjects?.nearby && (
        <span className="rounded-full border border-success/20 bg-success-soft px-3 py-1 text-xs text-success-ink">
          {en ? "Nearby dev projects" : "Projets résidentiels à proximité"}
        </span>
      )}
      {intel.permitDelays?.medianDays != null && (
        <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted">
          {en ? "Permit delays" : "Délais permis"}: {intel.permitDelays.medianDays}j
        </span>
      )}
    </div>
  );
}
