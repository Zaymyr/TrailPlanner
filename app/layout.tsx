import type { Metadata } from "next";
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
import { HeaderMenu } from "./header-menu";
import { SiteFooter } from "../components/SiteFooter";
import { CookieBanner } from "../components/CookieBanner";
import { GTagLoader } from "./gtag-loader";
import { ThemeToggle } from "../components/ThemeToggle";
import { ThemeDebugPanel } from "../components/ThemeDebugPanel";
import { SessionExpiredDialog } from "./session-expired-dialog";
import { TrialWelcomeDialog } from "./trial-welcome-dialog";

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
          <I18nProvider>
            <LocalizedMetadata />
            <AuthCallbackHandler />
            <SessionExpiredDialog />
            <TrialWelcomeDialog />
            <div className="flex w-full flex-col gap-8 px-6 py-10">
              <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <HeaderMenu />
                  <div className="space-y-1">
                    <Link href="/" aria-label="Go to home" className="inline-flex">
                      <Image
                        src="/branding/logo-horizontal.png"
                        alt="Pace Yourself"
                        width={220}
                        height={44}
                        priority
                        className="h-15 w-auto"
                      />
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Plan your aid-station timing, fueling targets, and pacing for race day.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <LanguageToggle />
                  <ThemeToggle />
                  <HeaderAuth />
                </div>
              </header>
              <main className="pb-6 sm:pb-8 lg:pb-10">{children}</main>
              <SiteFooter />
            </div>
          </I18nProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
