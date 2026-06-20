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
    <div className="mx-auto max-w-3xl px-4 py-16 text-ink">
      <h1 className="text-3xl font-bold text-ink">{t("privacyTitle")}</h1>
      <p className="mt-4 text-muted">{t("privacyUpdated")}</p>

      <section className="mt-10 space-y-4 text-muted">
        <h2 className="text-xl font-semibold text-ink">{t("privacy1Title")}</h2>
        <p>{t("privacy1Body")}</p>

        <h2 className="text-xl font-semibold text-ink">{t("privacy2Title")}</h2>
        <p>{t("privacy2Body")}</p>

        <h2 className="text-xl font-semibold text-ink">{t("privacy3Title")}</h2>
        <p>{t("privacy3Body")}</p>

        <h2 className="text-xl font-semibold text-ink">{t("privacy4Title")}</h2>
        <p>{t("privacy4Body")}</p>
      </section>

      <p className="mt-10">
        <Link href="/terms" className="text-brand hover:underline">
          {t("termsLink")} →
        </Link>
      </p>
    </div>
  );
}
