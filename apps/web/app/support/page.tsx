import type { Metadata } from "next";

import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, localeToOgLocale, SITE_URL } from "../seo";
import { supportCopy } from "./copy";
import { SupportClientPage } from "./page-client";

const canonicalPath = "/support";
const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
const copy = supportCopy.fr;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: copy.meta.title,
  description: copy.meta.description,
  alternates: {
    canonical: canonicalPath,
    languages: {
      "fr-FR": canonicalPath,
      "x-default": canonicalPath,
    },
  },
  openGraph: {
    title: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    siteName: "Pace Yourself",
    locale: localeToOgLocale("fr"),
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: copy.meta.title,
    description: copy.meta.description,
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
  },
};

export default function SupportPage() {
  return <SupportClientPage locale="fr" />;
}
