import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import Script from "next/script";
import { I18nProvider } from "./i18n-provider";
import { LanguageToggle } from "./language-toggle";
import { Analytics } from "./analytics";
import { LocalizedMetadata } from "./localized-metadata";
import { buildLocaleMetaCopy, CANONICAL_PATH, CANONICAL_URL, localeToOgLocale, SITE_URL } from "./seo";
import type { Locale } from "../locales/types";
import { HeaderAuth } from "./header-auth";
import { AuthCallbackHandler } from "./auth-callback-handler";

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
      siteName: "TrailPlanner",
      locale: ogLocale,
      alternateLocale: [localeToOgLocale(locale === "en" ? "fr" : "en")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
      <head>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-XP1FWYW1W6"
          strategy="afterInteractive"
        />
        <Script id="ga-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-XP1FWYW1W6');
          `}
        </Script>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <Analytics />
        <I18nProvider>
          <LocalizedMetadata />
          <AuthCallbackHandler />
          <div className="flex w-full flex-col gap-8 px-6 py-10">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Trailplanner</p>
                <h1 className="text-2xl font-semibold leading-tight text-slate-50">Race Fuel Planner</h1>
                <p className="text-sm text-slate-300">
                  Plan your aid-station timing, fueling targets, and pacing for race day.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <LanguageToggle />
                <HeaderAuth />
              </div>
            </header>
            <main className="pb-10">{children}</main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
