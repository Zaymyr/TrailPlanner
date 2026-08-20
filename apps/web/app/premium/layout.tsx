import type { Metadata } from "next";
import type { ReactNode } from "react";

import { localeToOgLocale, SITE_URL } from "../seo";

const canonicalPath = "/premium";
const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();
const title = "Pace Yourself Premium : plans trail illimités";
const description =
  "Débloquez les plans de course illimités, le remplissage nutritionnel automatique et les exports PDF et CSV avec Pace Yourself Premium.";

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
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function PremiumLayout({ children }: { children: ReactNode }) {
  return children;
}
