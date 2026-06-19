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
      <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        <div className="select-none blur-sm">
          <p className="text-xs text-slate-400">{t("lockedPreview")}</p>
          <p className="mt-1 text-sm text-slate-300">
            {layerCount} {t("layersDetected")}
          </p>
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-slate-950/75">
          <Lock className="h-4 w-4 text-amber-400" />
          <span className="text-xs text-amber-200">{t("upgradeIntel")}</span>
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
    <div className="mt-3 space-y-2 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {t("title")}
      </p>
      <IntelligenceLayerBadges intel={intel} locale={locale} />

      {access === "full" && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {intel.assessment?.totalValue != null && (
            <>
              <dt className="text-slate-500">{t("assessment")}</dt>
              <dd className="text-slate-200">
                {formatCad(intel.assessment.totalValue, locale)}
              </dd>
            </>
          )}
          {intel.recentTransaction?.salePrice != null && (
            <>
              <dt className="text-slate-500">{t("lastSale")}</dt>
              <dd className="text-slate-200">
                {formatCad(intel.recentTransaction.salePrice, locale)}
              </dd>
            </>
          )}
          {intel.propertyTax?.amount != null && (
            <>
              <dt className="text-slate-500">{t("taxRoll")}</dt>
              <dd className="text-slate-200">
                {formatCad(intel.propertyTax.amount, locale)}
                {intel.propertyTax.year ? ` (${intel.propertyTax.year})` : ""}
              </dd>
            </>
          )}
          {intel.zoning?.densityZone && (
            <>
              <dt className="text-slate-500">{t("zoning")}</dt>
              <dd className="text-slate-200">{intel.zoning.densityZone}</dd>
            </>
          )}
          {intel.marketHeat?.permitCount != null && (
            <>
              <dt className="text-slate-500">{t("marketHeat")}</dt>
              <dd className="text-slate-200">
                {intel.marketHeat.permitCount} {t("permitsBorough")} · {intel.marketHeat.level}
              </dd>
            </>
          )}
          {intel.municipalContracts && intel.municipalContracts.supplierMatches > 0 && (
            <>
              <dt className="text-slate-500">{t("contracts")}</dt>
              <dd className="text-slate-200">
                {intel.municipalContracts.supplierMatches} {t("contractMatches")}
              </dd>
            </>
          )}
          {intel.roadworks?.nearby && (
            <>
              <dt className="text-slate-500">{t("roadworks")}</dt>
              <dd className="text-slate-200">
                {intel.roadworks.count} {t("nearby")}
              </dd>
            </>
          )}
          {intel.commercialVacancyNearby != null && intel.commercialVacancyNearby > 0 && (
            <>
              <dt className="text-slate-500">{t("vacancy")}</dt>
              <dd className="text-slate-200">{intel.commercialVacancyNearby}</dd>
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
