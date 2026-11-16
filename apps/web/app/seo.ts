import type { Locale } from "../locales/types";

const DEFAULT_SITE_URL = "https://pace-yourself.com";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL;
export const HOME_PATH = "/";
export const RACE_PLANNER_PATH = "/race-planner";
export const CANONICAL_PATH = HOME_PATH;
export const CANONICAL_URL = new URL(CANONICAL_PATH, SITE_URL).toString();
export const RACE_PLANNER_URL = new URL(RACE_PLANNER_PATH, SITE_URL).toString();
export const DEFAULT_SOCIAL_IMAGE_PATH = "/branding/social-preview-v2.png";
export const DEFAULT_SOCIAL_IMAGE = {
  url: DEFAULT_SOCIAL_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: "Pace Yourself : livret coureur, livret supporter et plan de course trail",
};

export const localeToOgLocale = (locale: Locale): string =>
  locale === "fr" ? "fr_FR" : "en_US";

export const localeToLanguageTag = (locale: Locale): string =>
  locale === "fr" ? "fr-FR" : "en-US";

export const buildLocaleMetaCopy = (locale: Locale) => {
  if (locale === "fr") {
    return {
      title: "Pace Yourself : livret coureur, livret supporter et plan trail",
      description:
        "Le Livret coureur officiel de ta course, le Livret supporter pour tes proches, ton temps estimé gratuit sur chaque trail du catalogue et ton plan ravito.",
    };
  }

  return {
    title: "Pace Yourself: trail Race Book, Supporter Guide and race plan",
    description:
      "Your race's official Race Book, a Supporter Guide for your family and friends, free finish-time estimates and a fueling plan for trail and ultra races.",
  };
};
