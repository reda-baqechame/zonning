import { getLocale } from "next-intl/server";
import { Database } from "lucide-react";
import { getRuntimeDataMode } from "@/lib/data-mode";

export async function DataModeBanner() {
  if (getRuntimeDataMode() !== "local") return null;

  const locale = await getLocale();
  return (
    <div className="flex items-center justify-center gap-2 border-b border-warning/25 bg-warning-soft px-4 py-2 text-center text-xs text-warning-ink">
      <Database className="h-3.5 w-3.5 shrink-0" />
      <span>
        {locale === "fr"
          ? "Données locales de développement. Elles peuvent inclure des exemples semés et ne doivent pas être présentées comme des données en direct."
          : "Local development data. It may include seeded examples and must not be presented as live data."}
      </span>
    </div>
  );
}
