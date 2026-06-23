import { requireOnboardingComplete } from "@/lib/require-page";
import VaultClient from "./VaultClient";

export default async function VaultPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOnboardingComplete(locale);
  return <VaultClient />;
}
