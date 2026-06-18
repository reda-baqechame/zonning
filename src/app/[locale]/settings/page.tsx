import SettingsClient from "./SettingsClient";
import { requireOnboardingComplete } from "@/lib/require-page";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOnboardingComplete(locale);
  return <SettingsClient />;
}
