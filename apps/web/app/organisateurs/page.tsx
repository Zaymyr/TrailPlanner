import type { Metadata } from "next";

import { extractOrganizerAttribution, buildOrganizerCreationHref } from "../../lib/organizer-acquisition";
import { OrganizerLandingPage } from "./organizer-landing-page";
import { SITE_URL } from "../seo";

const canonicalPath = "/organisateurs";
const title = "Race Book numérique pour organisateurs de trails | Pace Yourself";
const description =
  "Rassemblez parcours, horaires, ravitaillements, matériel et informations pratiques dans un Race Book mobile simple à consulter par vos coureurs.";
const ogImage = new URL("/landing/organisateurs/trail-tst-cover.jpg", SITE_URL).toString();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: canonicalPath },
  openGraph: {
    title,
    description,
    url: new URL(canonicalPath, SITE_URL).toString(),
    siteName: "Pace Yourself",
    locale: "fr_FR",
    type: "website",
    images: [{ url: ogImage, alt: "Trail TST, événement de démonstration Pace Yourself" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  robots: { index: true, follow: true },
};

type OrganizersLandingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function OrganizersLandingPage({ searchParams }: OrganizersLandingPageProps) {
  const attribution = extractOrganizerAttribution(searchParams);

  return (
    <OrganizerLandingPage
      attribution={attribution}
      creationHref={buildOrganizerCreationHref(attribution)}
    />
  );
}
