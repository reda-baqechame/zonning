import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import PaiementPublicClient from "./PaiementPublicClient";

export default async function PaiementPublicPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getSessionUser();
  if (!user) {
    redirect({ href: "/login", locale });
    return null;
  }
  return <PaiementPublicClient />;
}
