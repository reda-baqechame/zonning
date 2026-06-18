import FeedClient from "./FeedClient";
import { requireOnboardingComplete } from "@/lib/require-page";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireOnboardingComplete(locale);
  return <FeedClient />;
}
