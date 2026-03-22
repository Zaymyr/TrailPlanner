"use client";

import React from "react";

import { translations } from "../locales";
import type { Locale, Translations } from "../locales/types";

type I18nContextValue = {
  locale: Locale;
  toggleLocale: () => void;
  t: Translations;
};

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

const resolveInitialLocale = (): Locale => {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLocale = window.localStorage.getItem("locale");
  if (storedLocale === "en" || storedLocale === "fr") {
    return storedLocale;
  }

  const browserLanguage = window.navigator.language?.toLowerCase() ?? "";
  if (browserLanguage.startsWith("fr")) {
    return "fr";
  }

  return "en";
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocale] = React.useState<Locale>(() => resolveInitialLocale());

  const toggleLocale = React.useCallback(() => {
    setLocale((current) => (current === "en" ? "fr" : "en"));
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.lang = locale;
    window.localStorage.setItem("locale", locale);
  }, [locale]);

  const t = React.useMemo(() => translations[locale], [locale]);

  const value = React.useMemo(
    () => ({
      locale,
      toggleLocale,
      t,
    }),
    [locale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = React.useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
};
