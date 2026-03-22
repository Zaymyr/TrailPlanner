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
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-3xl -translate-x-1/2 rounded-2xl bg-slate-900/95 p-4 shadow-xl shadow-emerald-900/40 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="space-y-1 text-sm text-slate-100 sm:text-base">
          <p className="font-semibold text-slate-50">Gestion des cookies</p>
          <p className="text-slate-300">
            Nous utilisons des cookies pour analyser le trafic et améliorer votre expérience. Vous pouvez accepter ou
            refuser les cookies non essentiels.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
          <button
            type="button"
            aria-label="Tout refuser"
            onClick={() => handleChoice("refused")}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:w-auto"
          >
            Tout refuser
          </button>
          <button
            type="button"
            aria-label="Tout accepter"
            onClick={() => handleChoice("accepted")}
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:w-auto"
          >
            Tout accepter
          </button>
        </div>
      </div>
    </div>
  );
}
