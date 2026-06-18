import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-white">{t("privacyTitle")}</h1>
      <p className="mt-4 text-slate-400">{t("privacyUpdated")}</p>

      <section className="mt-10 space-y-4 text-slate-300">
        <h2 className="text-xl font-semibold text-white">{t("privacy1Title")}</h2>
        <p>{t("privacy1Body")}</p>

        <h2 className="text-xl font-semibold text-white">{t("privacy2Title")}</h2>
        <p>{t("privacy2Body")}</p>

        <h2 className="text-xl font-semibold text-white">{t("privacy3Title")}</h2>
        <p>{t("privacy3Body")}</p>

        <h2 className="text-xl font-semibold text-white">{t("privacy4Title")}</h2>
        <p>{t("privacy4Body")}</p>
      </section>

      <p className="mt-10">
        <Link href="/terms" className="text-sky-400 hover:text-sky-300">
          {t("termsLink")} →
        </Link>
      </p>
    </div>
  );
}
