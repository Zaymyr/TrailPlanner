"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { translations } from "../locales";
import type { Locale } from "../locales/types";
import { useI18n } from "./i18n-provider";
import { CANONICAL_URL, localeToOgLocale, SITE_URL } from "./seo";

const upsertMeta = (
  type: "name" | "property",
  key: string,
  content: string,
): void => {
  const selector = `meta[${type}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(type, key);
    document.head.appendChild(element);
  }

  element.content = content;
};

const upsertLink = (rel: string, href: string): void => {
  const selector = `link[rel="${rel}"]`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;
};

type RouteMeta = {
  locale: Locale;
  title: string;
  description: string;
  canonicalPath: string;
};

const getRouteMeta = (pathname: string): RouteMeta | undefined => {
  switch (pathname) {
    case "/partenaires":
      return {
        locale: "fr",
        title: translations.fr.partners.meta.title,
        description: translations.fr.partners.meta.description,
        canonicalPath: "/partenaires",
      };
    case "/en/partners":
      return {
        locale: "en",
        title: translations.en.partners.meta.title,
        description: translations.en.partners.meta.description,
        canonicalPath: "/en/partners",
      };
    case "/links":
      return {
        locale: "fr",
        title: translations.fr.links.meta.title,
        description: translations.fr.links.meta.description,
        canonicalPath: "/links",
      };
    case "/en/links":
      return {
        locale: "en",
        title: translations.en.links.meta.title,
        description: translations.en.links.meta.description,
        canonicalPath: "/en/links",
      };
    default:
      return undefined;
  }
};

export function LocalizedMetadata() {
  const { t, locale } = useI18n();
  const pathname = usePathname();

  React.useEffect(() => {
    const routeMeta = getRouteMeta(pathname);
    const title = routeMeta?.title ?? t.homeHero.heading;
    const description = routeMeta?.description ?? t.homeHero.description;
    const ogLocale = localeToOgLocale(routeMeta?.locale ?? locale);
    const canonicalUrl = routeMeta ? new URL(routeMeta.canonicalPath, SITE_URL).toString() : CANONICAL_URL;

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:locale", ogLocale);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertLink("canonical", canonicalUrl);
  }, [locale, pathname, t]);

  return null;
}
