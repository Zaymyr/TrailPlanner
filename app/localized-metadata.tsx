"use client";

import React from "react";

import { useI18n } from "./i18n-provider";
import { CANONICAL_URL, localeToOgLocale } from "./seo";

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

  React.useEffect(() => {
    const title = t.homeHero.heading;
    const description = t.homeHero.description;
    const ogLocale = localeToOgLocale(locale);

    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:locale", ogLocale);
    upsertMeta("property", "og:url", CANONICAL_URL);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    upsertLink("canonical", CANONICAL_URL);
  }, [locale, t]);

  return null;
}
