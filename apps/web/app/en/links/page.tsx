import type { Metadata } from "next";

import { LinksPage } from "../../../components/landing/LinksPage";
import { translations } from "../../../locales";
import { localeToOgLocale, SITE_URL } from "../../seo";

const locale = "en";
const copy = translations[locale].links;
const canonicalPath = "/en/links";
const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
const ogImage = new URL("/landing/hero.png", SITE_URL).toString();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: {
    canonical: canonicalPath,
    languages: {
      fr: "/links",
      en: canonicalPath,
    },
  },
  openGraph: {
    title: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    siteName: "Pace Yourself",
    locale: localeToOgLocale(locale),
    alternateLocale: [localeToOgLocale("fr")],
    type: "website",
    images: [
      {
        url: ogImage,
        alt: copy.meta.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
    images: [ogImage],
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function LinksEnPage() {
  return <LinksPage copy={copy} locale={locale} />;
}
