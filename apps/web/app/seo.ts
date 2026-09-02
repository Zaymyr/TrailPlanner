import type { Locale } from "../locales/types";

const DEFAULT_SITE_URL = "https://pace-yourself.com";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
export const HOME_PATH = "/";
export const RACE_PLANNER_PATH = "/race-planner";
export const CANONICAL_PATH = HOME_PATH;
export const CANONICAL_URL = new URL(CANONICAL_PATH, SITE_URL).toString();
export const RACE_PLANNER_URL = new URL(RACE_PLANNER_PATH, SITE_URL).toString();
export const DEFAULT_SOCIAL_IMAGE_PATH = "/landing/secondary.png";
export const DEFAULT_SOCIAL_IMAGE = {
  url: DEFAULT_SOCIAL_IMAGE_PATH,
  width: 770,
  height: 381,
  alt: "Aperçu du planificateur de course Pace Yourself",
};

export const localeToOgLocale = (locale: Locale): string =>
  locale === "fr" ? "fr_FR" : "en_US";

export const localeToLanguageTag = (locale: Locale): string =>
  locale === "fr" ? "fr-FR" : "en-US";

export const buildLocaleMetaCopy = (locale: Locale) => {
  if (locale === "fr") {
    return {
      title: "Planificateur de nutrition trail et ultra | Pace Yourself",
      description:
        "Créez votre plan de nutrition trail : glucides, eau, sodium, allure et ravitaillements adaptés à votre parcours et à votre objectif.",
    };
  }

  return {
    title: "Trail and ultra nutrition planner | Pace Yourself",
    description:
      "Build a trail nutrition plan with carbohydrate, hydration, sodium, pacing, and aid-station targets adapted to your course.",
  };
};
