import { getTranslations } from "next-intl/server";
import { Info } from "lucide-react";
import { getDataModeStatus } from "@/lib/sync/demo-fallback";

/**
 * Thin top strip shown only when the app is serving demo-fallback content
 * (production database empty, demo data seeded). Makes the "demo mode" state
 * unmistakable instead of silently presenting demo data as live.
 */
export async function DemoModeBanner() {
  const status = await getDataModeStatus().catch(() => null);
  if (!status || status.mode !== "demo") return null;

  const t = await getTranslations("demoMode");

  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-300">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span>{t("banner")}</span>
    </div>
  );
}
