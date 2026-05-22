import type { Metadata } from "next";

import { PartnersPage } from "../../components/landing/PartnersPage";
import { translations } from "../../locales";
import { localeToOgLocale, SITE_URL } from "../seo";

const locale = "fr";
const copy = translations[locale].partners;
const canonicalPath = "/partenaires";
const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
const ogImage = new URL("/landing/hero.png", SITE_URL).toString();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: {
    canonical: canonicalPath,
    languages: {
      fr: canonicalPath,
      en: "/en/partners",
    },
  },
  openGraph: {
    title: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    siteName: "Pace Yourself",
    locale: localeToOgLocale(locale),
    alternateLocale: [localeToOgLocale("en")],
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
    index: true,
    follow: true,
  },
};

export default function PartnersFrPage() {
  return <PartnersPage copy={copy} locale={locale} />;
}
