import ComplianceClient from "./ComplianceClient";
import { requirePlan } from "@/lib/require-page";

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePlan(locale, "PRO");
  return <ComplianceClient />;
}
