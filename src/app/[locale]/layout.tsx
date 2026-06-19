import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { NavBar } from "@/components/NavBar";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";
import { ToastProvider } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import "@/app/globals.css";

const ibmPlex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex",
  display: "swap",
});

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
    <html lang={locale} className={`h-full ${ibmPlex.variable}`}>
      <body className={`${ibmPlex.className} min-h-full bg-slate-950 text-slate-100 antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            <DemoModeBanner />
            <NavBar user={user} />
            <main className="min-h-[calc(100vh-8rem)]">{children}</main>
            <SiteFooter />
            <CookieConsent />
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
