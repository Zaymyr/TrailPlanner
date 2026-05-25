"use client";

import { useEffect, useState } from "react";

import { COOKIE_CONSENT_EVENT, CookieConsentValue, getCookieConsent, setCookieConsent } from "../lib/cookies/consent";

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    const consent = getCookieConsent();

    if (!consent) {
      setIsVisible(true);
    }

    const handleConsentChange = () => {
      const updatedConsent = getCookieConsent();
      setIsVisible(!updatedConsent);
    };

    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    };
  }, []);

  const handleChoice = (value: CookieConsentValue) => {
    setCookieConsent(value);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-brand-border bg-card/95 p-4 text-foreground shadow-xl shadow-[rgba(45,80,22,0.14)] backdrop-blur sm:bottom-4 sm:p-5 dark:border-emerald-500/30 dark:bg-slate-950/95 dark:shadow-emerald-950/40">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="space-y-1 text-sm text-foreground sm:text-base">
          <p className="font-semibold text-foreground">Gestion des cookies</p>
          <p className="text-muted-foreground">
            Nous utilisons des cookies pour analyser le trafic et améliorer votre expérience. Vous pouvez accepter ou
            refuser les cookies non essentiels.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
          <button
            type="button"
            aria-label="Tout refuser"
            onClick={() => handleChoice("refused")}
            className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:border-brand-border hover:bg-brand-surface hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] sm:w-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-400/60 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100 dark:focus-visible:outline-emerald-400"
          >
            Tout refuser
          </button>
          <button
            type="button"
            aria-label="Tout accepter"
            onClick={() => handleChoice("accepted")}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm shadow-[rgba(45,80,22,0.12)] transition hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] sm:w-auto dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 dark:focus-visible:outline-emerald-400"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
