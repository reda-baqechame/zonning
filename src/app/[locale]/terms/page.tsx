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
    <div className="mx-auto max-w-3xl px-4 py-16 text-ink">
      <h1 className="text-3xl font-bold text-ink">{t("termsTitle")}</h1>
      <p className="mt-4 text-muted">{t("termsUpdated")}</p>

      <section className="mt-10 space-y-4 text-muted">
        <h2 className="text-xl font-semibold text-ink">{t("terms1Title")}</h2>
        <p>{t("terms1Body")}</p>

        <h2 className="text-xl font-semibold text-ink">{t("terms2Title")}</h2>
        <p>{t("terms2Body")}</p>

        <h2 className="text-xl font-semibold text-ink">{t("terms3Title")}</h2>
        <p>{t("terms3Body")}</p>

        <h2 className="text-xl font-semibold text-ink">{t("terms4Title")}</h2>
        <p>{t("terms4Body")}</p>
      </section>

      <p className="mt-10">
        <Link href="/privacy" className="text-brand hover:underline">
          {t("privacyLink")} →
        </Link>
      </p>
    </div>
  );
}
