import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold text-white">{t("termsTitle")}</h1>
      <p className="mt-4 text-slate-400">{t("termsUpdated")}</p>

      <section className="mt-10 space-y-4 text-slate-300">
        <h2 className="text-xl font-semibold text-white">{t("terms1Title")}</h2>
        <p>{t("terms1Body")}</p>

        <h2 className="text-xl font-semibold text-white">{t("terms2Title")}</h2>
        <p>{t("terms2Body")}</p>

        <h2 className="text-xl font-semibold text-white">{t("terms3Title")}</h2>
        <p>{t("terms3Body")}</p>

        <h2 className="text-xl font-semibold text-white">{t("terms4Title")}</h2>
        <p>{t("terms4Body")}</p>
      </section>

      <p className="mt-10">
        <Link href="/privacy" className="text-sky-400 hover:text-sky-300">
          {t("privacyLink")} →
        </Link>
      </p>
    </div>
  );
}
