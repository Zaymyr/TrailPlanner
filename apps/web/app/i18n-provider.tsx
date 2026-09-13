"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { translations } from "../locales";
import type { Locale, Translations } from "../locales/types";

type I18nContextValue = {
  locale: Locale;
  toggleLocale: () => void;
  t: Translations;
};

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

const FRENCH_LOCALIZED_PATHS = new Set(["/links", "/partenaires"]);

export const getPathLocale = (pathname: string): Locale | undefined => {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  if (normalizedPath === "/en" || normalizedPath.startsWith("/en/")) {
    return "en";
  }

  if (FRENCH_LOCALIZED_PATHS.has(normalizedPath)) {
    return "fr";
  }

  return undefined;
};

export const resolveInitialLocale = (
  pathname: string,
  storedLocale?: string | null,
): Locale => {
  const pathLocale = getPathLocale(pathname);
  if (pathLocale) {
    return pathLocale;
  }

  if (storedLocale === "en" || storedLocale === "fr") {
    return storedLocale;
  }

  return "fr";
};

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const pathLocale = getPathLocale(pathname);
  const [locale, setLocale] = React.useState<Locale>(() =>
    resolveInitialLocale(
      pathname,
      typeof window === "undefined" ? undefined : window.localStorage.getItem("locale"),
    ),
  );

  React.useEffect(() => {
    if (pathLocale) {
      setLocale(pathLocale);
    }
  }, [pathLocale]);

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
