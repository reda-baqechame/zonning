import OnboardingClient from "./OnboardingClient";
import { redirect } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function OnboardingPage({
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
  if (user.onboardingComplete) {
    redirect({ href: "/feed", locale });
    return null;
  }
  return <OnboardingClient />;
}
