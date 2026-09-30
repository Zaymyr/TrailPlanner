import type { Metadata } from "next";

import { extractOrganizerAttribution, buildOrganizerCreationHref } from "../../lib/organizer-acquisition";
import { loadPublishedOrganizerSocialProofs } from "../../lib/organizer-social-proof-server";
import { OrganizerLandingPage } from "./organizer-landing-page";
import { SITE_URL } from "../seo";

const canonicalPath = "/organisateurs";
const title = "Livret coureur numérique pour organisateurs de trails | Pace Yourself";
const description =
  "Rassemblez parcours, horaires, ravitaillements, matériel et informations pratiques dans un Livret coureur mobile simple à consulter par vos coureurs.";
const ogImage = new URL("/landing/organisateurs/tst-course-ravitos.jpeg", SITE_URL).toString();

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
    images: [{ url: ogImage, alt: "Livret coureur TST affichant les informations de course et les ravitaillements" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  robots: { index: true, follow: true },
};

type OrganizersLandingPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function OrganizersLandingPage({ searchParams }: OrganizersLandingPageProps) {
  const attribution = extractOrganizerAttribution(searchParams);
  const socialProofs = await loadPublishedOrganizerSocialProofs();

  return (
    <OrganizerLandingPage
      attribution={attribution}
      creationHref={buildOrganizerCreationHref(attribution)}
      socialProofs={socialProofs}
    />
  );
}
