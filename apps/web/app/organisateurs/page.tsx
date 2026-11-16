import type { Metadata } from "next";

import { extractOrganizerAttribution, buildOrganizerCreationHref } from "../../lib/organizer-acquisition";
import { loadPublishedOrganizerSocialProofs } from "../../lib/organizer-social-proof-server";
import { OrganizerLandingPage } from "./organizer-landing-page";
import { SITE_URL } from "../seo";

const canonicalPath = "/organisateurs";
const title = "Livret coureur et livret supporter pour trails | Pace Yourself";
const description =
  "Livret coureur mobile (parcours, horaires, ravitos, matériel, accès) et Livret supporter pour les proches (programme, points de suivi, infos pratiques), partagé par QR code.";
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
