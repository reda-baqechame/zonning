import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { NavBar } from "@/components/NavBar";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";
import { getSessionUser } from "@/lib/auth";
import "@/app/globals.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "fr" | "en")) notFound();

  const messages = await getMessages();
  const user = await getSessionUser();

  return (
    <html lang={locale} className="h-full">
      <body className="min-h-full bg-slate-950 text-slate-100 antialiased">
        <NextIntlClientProvider messages={messages}>
          <NavBar user={user} />
          <main>{children}</main>
          <SiteFooter />
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
