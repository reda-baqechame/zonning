import { requireOnboardingComplete } from "@/lib/require-page";
import TriageClient from "./TriageClient";

export default async function TriagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOnboardingComplete(locale);
  return <TriageClient />;
}
