import ConciergeClient from "./ConciergeClient";
import { requireAuth } from "@/lib/require-page";

export default async function ConciergePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAuth(locale);
  return <ConciergeClient />;
}
