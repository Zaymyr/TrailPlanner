import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import Script from "next/script";
import { I18nProvider } from "./i18n-provider";
import { LanguageToggle } from "./language-toggle";
import { Analytics } from "./analytics";

export const metadata: Metadata = {
  title: "Race Fuel Planner",
  description: "Estimate aid-station timing and fueling needs for your next race.",
};

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
          <div className="flex w-full flex-col gap-8 px-6 py-10">
            <header className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">TrailPlanner</p>
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-semibold leading-tight text-slate-50">Race Fuel Planner</h1>
                  <LanguageToggle />
                </div>
                <p className="text-sm text-slate-300">
                  Plan your aid-station timing, fueling targets, and pacing for race day.
                </p>
              </div>
            </header>
            <main className="pb-10">{children}</main>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
