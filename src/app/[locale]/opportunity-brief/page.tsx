import { getSessionUser } from "@/lib/auth";
import { getRuntimeDataMode } from "@/lib/data-mode";
import OpportunityBriefClient from "./OpportunityBriefClient";

export default async function OpportunityBriefPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  const dataMode = getRuntimeDataMode();
  return (
    <OpportunityBriefClient
      locale={locale === "en" ? "en" : "fr"}
      initialUser={user}
      dataMode={dataMode}
    />
  );
}
