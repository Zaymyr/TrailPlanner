import type { Metadata } from "next";
import { Suspense } from "react";

import { localeToOgLocale, RACE_PLANNER_PATH, RACE_PLANNER_URL, SITE_URL } from "../../../seo";
import { RacePlannerPageContent } from "../RacePlannerPageContent";

const title = "Planificateur nutrition trail sur mobile | Pace Yourself";
const description =
  "Utilisez le planificateur Pace Yourself sur mobile pour préparer allure, glucides, eau, sodium et ravitaillements de votre trail.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: RACE_PLANNER_PATH },
  robots: { index: false, follow: true },
  openGraph: {
    title,
    description,
    url: RACE_PLANNER_URL,
    siteName: "Pace Yourself",
    locale: localeToOgLocale("fr"),
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

export default function RacePlannerMobilePage() {
  return (
    <Suspense fallback={null}>
      <RacePlannerPageContent enableMobileNav />
    </Suspense>
  );
}
