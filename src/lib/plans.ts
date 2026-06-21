import type { Plan } from "@/generated/prisma/client";
import { isFreeTestMode } from "@/lib/free-test";

export type PlanLimits = {
  maxPermits: number;
  maxTenders: number;
  maxAlerts: number;
  complianceVault: boolean;
  intelligenceFull: boolean;
};

const LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxPermits: 15,
    maxTenders: 3,
    maxAlerts: 0,
    complianceVault: false,
    intelligenceFull: false,
  },
  ESSENTIEL: {
    maxPermits: 75,
    maxTenders: 5,
    maxAlerts: 1,
    complianceVault: false,
    intelligenceFull: true,
  },
  PRO: {
    maxPermits: 200,
    maxTenders: 100,
    maxAlerts: 10,
    complianceVault: true,
    intelligenceFull: true,
  },
  EQUIPE: {
    maxPermits: 500,
    maxTenders: 500,
    maxAlerts: 50,
    complianceVault: true,
    intelligenceFull: true,
  },
};

export function getPlanLimits(plan: Plan | null | undefined): PlanLimits {
  if (isFreeTestMode()) return LIMITS.EQUIPE;
  return LIMITS[plan ?? "FREE"];
}

export function getEffectivePlan(plan: Plan | null | undefined): Plan {
  return isFreeTestMode() ? "EQUIPE" : plan ?? "FREE";
}

export function canCreateAlert(plan: Plan | null | undefined, currentCount: number): boolean {
  const limits = getPlanLimits(plan);
  return currentCount < limits.maxAlerts;
}
