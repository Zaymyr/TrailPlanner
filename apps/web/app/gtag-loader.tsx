"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";

import { canLoadAnalytics, COOKIE_CONSENT_EVENT } from "../lib/cookies/consent";

const GTAG_ID = "G-XP1FWYW1W6";

export function GTagLoader() {
  const [isEnabled, setIsEnabled] = useState<boolean>(canLoadAnalytics());

  useEffect(() => {
    setIsEnabled(canLoadAnalytics());
  }, []);

  useEffect(() => {
    const handleConsentChange = () => setIsEnabled(canLoadAnalytics());

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    };
  }, []);

  const scripts = useMemo(() => {
    if (!isEnabled) {
      return null;
    }

    return (
      <>
        <Script async src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="afterInteractive" />
        <Script id="ga-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GTAG_ID}');
          `}
        </Script>
      </>
    );
  }, [isEnabled]);

  return scripts;
}
