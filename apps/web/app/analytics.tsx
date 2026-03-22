"use client";

import { useEffect, useMemo, useState } from "react";
import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { canLoadAnalytics, COOKIE_CONSENT_EVENT } from "../lib/cookies/consent";

let hasInjectedAnalytics = false;

export function Analytics() {
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

  useEffect(() => {
    if (isEnabled && !hasInjectedAnalytics) {
      inject();
      hasInjectedAnalytics = true;
    }
  }, [isEnabled]);

  const speedInsights = useMemo(() => {
    if (!isEnabled) {
      return null;
    }

    return <SpeedInsights />;
  }, [isEnabled]);

  return speedInsights;
}
