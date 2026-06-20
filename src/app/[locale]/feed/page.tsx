import FeedClient from "./FeedClient";
import { getRuntimeDataMode } from "@/lib/data-mode";
import { requireOnboardingComplete } from "@/lib/require-page";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOnboardingComplete(locale);
  return <FeedClient dataMode={getRuntimeDataMode()} />;
}
