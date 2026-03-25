import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import React from "react";
import { I18nProvider } from "./i18n-provider";
import { LanguageToggle } from "./language-toggle";
import { Analytics } from "./analytics";
import { LocalizedMetadata } from "./localized-metadata";
import { buildLocaleMetaCopy, CANONICAL_PATH, CANONICAL_URL, localeToOgLocale, SITE_URL } from "./seo";
import type { Locale } from "../locales/types";
import { HeaderAuth } from "./header-auth";
import { AuthCallbackHandler } from "./auth-callback-handler";
import { QueryProvider } from "./query-client-provider";
import { HeaderTabs } from "./header-tabs";
import { SiteFooter } from "../components/SiteFooter";
import { CookieBanner } from "../components/CookieBanner";
import { GTagLoader } from "./gtag-loader";
import { ThemeToggle } from "../components/ThemeToggle";
import { ThemeDebugPanel } from "../components/ThemeDebugPanel";
import { SessionExpiredDialog } from "./session-expired-dialog";
import { TrialWelcomeDialog } from "./trial-welcome-dialog";
import { TrialExpiredNotice } from "./trial-expired-notice";
import { VerifiedSessionProvider } from "./hooks/useVerifiedSession";

const createMetadata = (locale: Locale): Metadata => {
  const { title, description } = buildLocaleMetaCopy(locale);
  const ogLocale = localeToOgLocale(locale);

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical: CANONICAL_PATH,
      languages: {
        en: CANONICAL_PATH,
        fr: CANONICAL_PATH,
      },
    },
    openGraph: {
      title,
      description,
      url: CANONICAL_URL,
      siteName: "Pace Yourself",
      locale: ogLocale,
      alternateLocale: [localeToOgLocale(locale === "en" ? "fr" : "en")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    icons: {
      icon: [{ url: "/branding/favicon.png", type: "image/png" }],
    },
  };
};

export const metadata: Metadata = createMetadata("en");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-background text-foreground">
        <GTagLoader />
        <Analytics />
        <CookieBanner />
        <ThemeDebugPanel />
        <QueryProvider>
          <VerifiedSessionProvider>
            <I18nProvider>
              <LocalizedMetadata />
              <AuthCallbackHandler />
              <SessionExpiredDialog />
              <TrialWelcomeDialog />
              <TrialExpiredNotice />
              <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:gap-8 lg:py-10">
                <header className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <Link href="/" aria-label="Go to home" className="inline-flex flex-shrink-0">
                      <Image
                        src="/branding/logo-horizontal.png"
                        alt="Pace Yourself"
                        width={220}
                        height={44}
                        priority
                        className="h-10 w-auto sm:h-15"
                      />
                    </Link>
                    <HeaderTabs />
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <LanguageToggle />
                    <ThemeToggle />
                    <HeaderAuth />
                  </div>
                </header>
                <main className="pb-6 sm:pb-8 lg:pb-10">{children}</main>
                <SiteFooter />
              </div>
            </I18nProvider>
          </VerifiedSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
