import ExportClient from "./ExportClient";
import { requirePlan } from "@/lib/require-page";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requirePlan(locale, "ESSENTIEL");
  return <ExportClient />;
}
