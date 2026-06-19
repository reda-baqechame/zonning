import ComplianceClient from "./ComplianceClient";
import { requireAuth, planHasComplianceVault } from "@/lib/require-page";

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireAuth(locale);
  if (!user) return null;
  return <ComplianceClient entitled={planHasComplianceVault(user.plan)} />;
}
