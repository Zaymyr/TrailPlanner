import type { Locale } from "../locales/types";
import { translations } from "../locales";

const DEFAULT_SITE_URL = "https://pace-yourself.com";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
export const HOME_PATH = "/";
export const RACE_PLANNER_PATH = "/race-planner";
export const CANONICAL_PATH = HOME_PATH;
export const CANONICAL_URL = new URL(CANONICAL_PATH, SITE_URL).toString();
export const RACE_PLANNER_URL = new URL(RACE_PLANNER_PATH, SITE_URL).toString();

export const localeToOgLocale = (locale: Locale): string =>
  locale === "fr" ? "fr_FR" : "en_US";

export const buildLocaleMetaCopy = (locale: Locale) => {
  const copy = translations[locale];

  return {
    title: copy.homeHero.heading,
    description: copy.homeHero.description,
  };
};
