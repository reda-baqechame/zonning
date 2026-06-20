"use client";

import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import IntelligenceLayerBadges from "@/components/IntelligenceLayerBadges";
import { formatCad } from "@/lib/format-cad";
import type { PropertyIntelligence } from "@/lib/intelligence";

export type IntelAccess = "full" | "summary" | "locked";

type Props = {
  intel?: PropertyIntelligence | null;
  locale: string;
  access?: IntelAccess;
};

export default function SiteIntelligencePanel({
  intel,
  locale,
  access = "full",
}: Props) {
  const t = useTranslations("intel");

  if (!intel) return null;

  if (access === "locked") {
    const layerCount =
      (intel.contamination?.gtcNearby ? 1 : 0) +
      (intel.heritage?.nearby ? 1 : 0) +
      (intel.zoning?.densityZone ? 1 : 0) +
      (intel.assessment?.totalValue ? 1 : 0) +
      (intel.developmentProjects?.nearby ? 1 : 0);

    if (layerCount === 0) return null;

    return (
      <div className="relative mt-3 overflow-hidden rounded-lg border border-line bg-surface-2 p-3">
        <div className="select-none blur-sm">
          <p className="text-xs text-muted">{t("lockedPreview")}</p>
          <p className="mt-1 text-sm text-ink">
            {layerCount} {t("layersDetected")}
          </p>
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/80 backdrop-blur-[2px]">
          <Lock className="h-4 w-4 text-warning-ink" />
          <span className="text-xs text-warning-ink">{t("upgradeIntel")}</span>
        </div>
      </div>
    );
  }

  const hasDetail =
    intel.assessment?.totalValue ||
    intel.recentTransaction?.salePrice ||
    intel.propertyTax?.amount ||
    intel.marketHeat?.permitCount ||
    intel.municipalContracts?.supplierMatches ||
    intel.roadworks?.nearby;

  if (access === "summary" && !hasDetail) {
    return <IntelligenceLayerBadges intel={intel} locale={locale} />;
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
        {t("title")}
      </p>
      <IntelligenceLayerBadges intel={intel} locale={locale} />

      {access === "full" && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {intel.assessment?.totalValue != null && (
            <>
              <dt className="text-subtle">{t("assessment")}</dt>
              <dd className="text-ink">
                {formatCad(intel.assessment.totalValue, locale)}
              </dd>
            </>
          )}
          {intel.recentTransaction?.salePrice != null && (
            <>
              <dt className="text-subtle">{t("lastSale")}</dt>
              <dd className="text-ink">
                {formatCad(intel.recentTransaction.salePrice, locale)}
              </dd>
            </>
          )}
          {intel.propertyTax?.amount != null && (
            <>
              <dt className="text-subtle">{t("taxRoll")}</dt>
              <dd className="text-ink">
                {formatCad(intel.propertyTax.amount, locale)}
                {intel.propertyTax.year ? ` (${intel.propertyTax.year})` : ""}
              </dd>
            </>
          )}
          {intel.zoning?.densityZone && (
            <>
              <dt className="text-subtle">{t("zoning")}</dt>
              <dd className="text-ink">{intel.zoning.densityZone}</dd>
            </>
          )}
          {intel.marketHeat?.permitCount != null && (
            <>
              <dt className="text-subtle">{t("marketHeat")}</dt>
              <dd className="text-ink">
                {intel.marketHeat.permitCount} {t("permitsBorough")} · {intel.marketHeat.level}
              </dd>
            </>
          )}
          {intel.municipalContracts && intel.municipalContracts.supplierMatches > 0 && (
            <>
              <dt className="text-subtle">{t("contracts")}</dt>
              <dd className="text-ink">
                {intel.municipalContracts.supplierMatches} {t("contractMatches")}
              </dd>
            </>
          )}
          {intel.roadworks?.nearby && (
            <>
              <dt className="text-subtle">{t("roadworks")}</dt>
              <dd className="text-ink">
                {intel.roadworks.count} {t("nearby")}
              </dd>
            </>
          )}
          {intel.commercialVacancyNearby != null && intel.commercialVacancyNearby > 0 && (
            <>
              <dt className="text-subtle">{t("vacancy")}</dt>
              <dd className="text-ink">{intel.commercialVacancyNearby}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

export function intelAccessForPlan(plan?: string | null): IntelAccess {
  if (plan === "PRO" || plan === "EQUIPE") return "full";
  if (plan === "ESSENTIEL") return "summary";
  return "locked";
}
