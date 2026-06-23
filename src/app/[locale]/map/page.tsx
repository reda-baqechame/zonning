import { redirect } from "@/i18n/navigation";

export default async function MapAliasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/carte", locale });
}
