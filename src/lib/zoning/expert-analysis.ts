import { differenceInCalendarDays } from "date-fns";
import type { PropertyIntelligence } from "@/lib/intelligence";

export type ZoningProjectInput = {
  desiredUse?: string | null;
  proposedFloors?: number | null;
  proposedUnits?: number | null;
};

export type ZoningCheckId =
  | "parcel_identity"
  | "zone_by_law"
  | "permitted_use"
  | "height_and_density"
  | "setbacks_and_coverage"
  | "parking_and_loading"
  | "overlays_and_constraints"
  | "discretionary_approvals"
  | "pending_amendments";

export type ZoningWarningId =
  | "planning_not_regulation"
  | "nearest_centroid_not_parcel"
  | "borough_summary_not_parcel"
  | "uses_not_verified"
  | "dimensions_not_verified"
  | "overlays_not_exhaustive"
  | "amendments_not_checked"
  | "project_not_defined";

export type ZoningExpertAnalysis = {
  status: "confirmed" | "indicative" | "review_required" | "unavailable";
  decision: "not_determined" | "compatible" | "conditional" | "incompatible";
  confidence: number;
  canConcludeCompliance: boolean;
  project: ZoningProjectInput;
  evidence: Array<{
    kind: "municipal_bylaw" | "strategic_plan" | "regional_dataset" | "borough_summary";
    label: string;
    value?: string | number | null;
    sourceUrl?: string | null;
    sourceFetchedAt?: string | null;
    scope: "parcel" | "planning_area_nearby" | "borough_summary";
    matchDistanceMeters?: number | null;
  }>;
  checks: Array<{ id: ZoningCheckId; status: "verified" | "partial" | "missing" }>;
  warnings: ZoningWarningId[];
  verifiedCheckCount: number;
  totalCheckCount: number;
  generatedAt: string;
};

function zoningConfidence(intel: PropertyIntelligence, now: Date): number {
  const zoning = intel.zoning;
  if (!zoning) return 0;
  if (zoning.determination === "confirmed" && zoning.evidenceScope === "parcel") return 90;

  let score = zoning.source === "regional" && zoning.zoneCode ? 45 : zoning.source === "pum2050" ? 35 : 15;
  if (zoning.sourceUrl?.startsWith("https://")) score += 5;
  if (zoning.sourceFetchedAt) {
    const fetchedAt = new Date(zoning.sourceFetchedAt);
    if (!Number.isNaN(fetchedAt.getTime()) && differenceInCalendarDays(now, fetchedAt) <= 180) {
      score += 5;
    }
  }
  return Math.min(score, 55);
}

function hasOverlaySignal(intel: PropertyIntelligence): boolean {
  const heritage = intel.heritage;
  const contamination = intel.contamination;
  return Boolean(
    (heritage &&
      (heritage.nearby ||
        heritage.hasEip ||
        heritage.lpcProtected ||
        heritage.pum2050Listed ||
        heritage.count > 0)) ||
      (contamination &&
        (contamination.nearby ||
          contamination.gtcNearby ||
          contamination.count > 0 ||
          (contamination.gtcCount ?? 0) > 0)),
  );
}

export function buildZoningExpertAnalysis(
  intel: PropertyIntelligence,
  project: ZoningProjectInput = {},
  now = new Date(),
): ZoningExpertAnalysis {
  const zoning = intel.zoning;
  const confirmed = zoning?.determination === "confirmed" && zoning.evidenceScope === "parcel";
  const evidence: ZoningExpertAnalysis["evidence"] = [];

  if (zoning) {
    const kind =
      zoning.source === "pum2050"
        ? "strategic_plan"
        : zoning.source === "regional"
          ? "regional_dataset"
          : zoning.evidenceScope === "parcel"
            ? "municipal_bylaw"
            : "borough_summary";
    evidence.push({
      kind,
      label: zoning.description || zoning.zoneCode || zoning.landUse || "Zoning planning signal",
      value: zoning.zoneCode || zoning.landUse || zoning.intensificationLevel || zoning.densityThreshold,
      sourceUrl: zoning.sourceUrl,
      sourceFetchedAt: zoning.sourceFetchedAt,
      scope: zoning.evidenceScope ?? "planning_area_nearby",
      matchDistanceMeters: zoning.matchDistanceMeters,
    });
  }

  const checks: ZoningExpertAnalysis["checks"] = [
    { id: "parcel_identity", status: intel.matricule ? "verified" : "missing" },
    { id: "zone_by_law", status: confirmed ? "verified" : zoning ? "partial" : "missing" },
    { id: "permitted_use", status: "missing" },
    {
      id: "height_and_density",
      status: confirmed && zoning?.maxFloors != null ? "verified" : zoning?.densityThreshold != null ? "partial" : "missing",
    },
    { id: "setbacks_and_coverage", status: "missing" },
    { id: "parking_and_loading", status: "missing" },
    { id: "overlays_and_constraints", status: hasOverlaySignal(intel) ? "partial" : "missing" },
    { id: "discretionary_approvals", status: "missing" },
    { id: "pending_amendments", status: "missing" },
  ];

  const warnings = new Set<ZoningWarningId>();
  if (zoning?.source === "pum2050") warnings.add("planning_not_regulation");
  if (zoning?.matchMethod === "nearest_centroid") warnings.add("nearest_centroid_not_parcel");
  if (zoning?.matchMethod === "borough_summary") warnings.add("borough_summary_not_parcel");
  warnings.add("uses_not_verified");
  warnings.add("dimensions_not_verified");
  warnings.add("overlays_not_exhaustive");
  warnings.add("amendments_not_checked");
  if (!project.desiredUse && project.proposedFloors == null && project.proposedUnits == null) {
    warnings.add("project_not_defined");
  }

  const verifiedCheckCount = checks.filter((check) => check.status === "verified").length;
  return {
    status: confirmed
      ? "confirmed"
      : zoning?.determination === "review_required"
        ? "review_required"
        : zoning
          ? "indicative"
          : "unavailable",
    decision: "not_determined",
    confidence: zoningConfidence(intel, now),
    canConcludeCompliance: false,
    project,
    evidence,
    checks,
    warnings: [...warnings],
    verifiedCheckCount,
    totalCheckCount: checks.length,
    generatedAt: now.toISOString(),
  };
}
