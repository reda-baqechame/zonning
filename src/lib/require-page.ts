import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import { getEffectivePlan, getPlanLimits } from "@/lib/plans";
import { isFreeTestMode } from "@/lib/free-test";
import type { Plan } from "@/generated/prisma/client";

export async function requireAuth(locale: string) {
  const user = await getSessionUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }
  return user;
}

export async function requireOnboardingComplete(locale: string) {
  const user = await requireAuth(locale);
  if (!user) return null;
  if (isFreeTestMode()) return user;
  if (!user.onboardingComplete) {
    redirect({ href: "/onboarding", locale });
    return null;
  }
  return user;
}

export async function requirePlan(
  locale: string,
  minPlan: Plan | "PRO_PLUS"
) {
  const user = await requireOnboardingComplete(locale);
  if (!user) return null;
  if (isFreeTestMode()) return user;

  const order: Plan[] = ["FREE", "ESSENTIEL", "PRO", "EQUIPE"];
  const minIdx =
    minPlan === "PRO_PLUS"
      ? order.indexOf("PRO")
      : order.indexOf(minPlan);
  const userIdx = order.indexOf(getEffectivePlan(user.plan));

  if (userIdx < minIdx) {
    redirect({ href: "/pricing", locale });
    return null;
  }
  return user;
}

export function planHasComplianceVault(plan: Plan) {
  return getPlanLimits(plan).complianceVault;
}

export function planHasExport(plan: Plan) {
  return getEffectivePlan(plan) !== "FREE";
}
