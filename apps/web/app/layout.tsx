import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import React from "react";
import { I18nProvider } from "./i18n-provider";
import { Analytics } from "./analytics";
import { LocalizedMetadata } from "./localized-metadata";
import { buildLocaleMetaCopy, CANONICAL_PATH, CANONICAL_URL, localeToOgLocale, SITE_URL } from "./seo";
import type { Locale } from "../locales/types";
import { AuthCallbackHandler } from "./auth-callback-handler";
import { QueryProvider } from "./query-client-provider";
import { CookieBanner } from "../components/CookieBanner";
import { MobileAppPrompt } from "../components/MobileAppPrompt";
import { GTagLoader } from "./gtag-loader";
import { ThemeDebugPanel } from "../components/ThemeDebugPanel";
import { SessionExpiredDialog } from "./session-expired-dialog";
import { TrialWelcomeDialog } from "./trial-welcome-dialog";
import { TrialExpiredNotice } from "./trial-expired-notice";
import { VerifiedSessionProvider } from "./hooks/useVerifiedSession";
import { PostHogProvider } from "./posthog-provider";
import { RootChrome } from "./root-chrome";

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
      icon: [{ url: "/branding/favicon-v2.png", type: "image/png" }],
      shortcut: ["/branding/favicon-v2.png"],
      apple: [{ url: "/branding/logo-icon-v2.png", type: "image/png" }],
    },
  };
};

export const metadata: Metadata = createMetadata("en");

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="min-h-screen text-foreground">
        <GTagLoader />
        <Analytics />
        <CookieBanner />
        <ThemeDebugPanel />
        <QueryProvider>
          <VerifiedSessionProvider>
            <PostHogProvider>
              <I18nProvider>
                <LocalizedMetadata />
                <AuthCallbackHandler />
                <SessionExpiredDialog />
                <TrialWelcomeDialog />
                <TrialExpiredNotice />
                <MobileAppPrompt />
                <RootChrome>{children}</RootChrome>
              </I18nProvider>
            </PostHogProvider>
          </VerifiedSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
