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

export function LocalizedMetadata() {
  const { t, locale } = useI18n();
  const pathname = usePathname();

  React.useEffect(() => {
    const partnersLocale: Locale | undefined =
      pathname === "/partenaires" ? "fr" : pathname === "/en/partners" ? "en" : undefined;
    const partnersCopy = partnersLocale ? translations[partnersLocale].partners : undefined;
    const title = partnersCopy?.meta.title ?? t.homeHero.heading;
    const description = partnersCopy?.meta.description ?? t.homeHero.description;
    const ogLocale = localeToOgLocale(partnersLocale ?? locale);
    const canonicalUrl = partnersLocale ? new URL(pathname, SITE_URL).toString() : CANONICAL_URL;

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
