import { requireOnboardingComplete } from "@/lib/require-page";
import ProposalsClient from "./ProposalsClient";

export default async function ProposalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tenderId?: string }>;
}) {
  const { locale } = await params;
  const { tenderId } = await searchParams;
  await requireOnboardingComplete(locale);
  return <ProposalsClient initialTenderId={tenderId ?? ""} />;
}
