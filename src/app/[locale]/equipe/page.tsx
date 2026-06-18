import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";
import EquipeClient from "./EquipeClient";

export default async function EquipePage({
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
  if (user.plan !== "EQUIPE") {
    redirect({ href: "/pricing", locale });
    return null;
  }
  return <EquipeClient />;
}
