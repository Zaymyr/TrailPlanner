import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, localeToOgLocale, SITE_URL } from "../seo";

const canonicalPath = "/premium";
const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
const title = "Pace Yourself Premium : allures, ravitos et plan nutrition";
const description =
  "Ton temps estimé reste gratuit. Débloque le plan : allures par section, produits à chaque ravito, fiche imprimable, exports, pour une course ou à l’année.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: canonicalPath },
  openGraph: {
    title,
    description,
    url: canonicalUrl,
    siteName: "Pace Yourself",
    locale: localeToOgLocale("fr"),
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", title, description, images: [DEFAULT_SOCIAL_IMAGE_PATH] },
};

export default function PremiumLayout({ children }: { children: ReactNode }) {
  return children;
}
