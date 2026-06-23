import { getRuntimeDataMode } from "@/lib/data-mode";
import { requireOnboardingComplete } from "@/lib/require-page";
import PassportClient from "./PassportClient";

export default async function PassportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOnboardingComplete(locale);
  return <PassportClient dataMode={getRuntimeDataMode()} />;
}
