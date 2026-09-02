import type { Metadata } from "next";

import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../seo";

type LegalMetadataInput = {
  path: `/legal/${string}`;
  title: string;
  description: string;
};

export const buildLegalMetadata = ({ path, title, description }: LegalMetadataInput): Metadata => ({
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: path },
  openGraph: {
    title,
    description,
    url: new URL(path, SITE_URL),
    siteName: "Pace Yourself",
    locale: "fr_FR",
    type: "website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
  },
  robots: {
    index: false,
    follow: true,
  },
});
