import type { Metadata } from "next";
import { Suspense } from "react";

import { localeToOgLocale, RACE_PLANNER_PATH, RACE_PLANNER_URL, SITE_URL } from "../../seo";
import { RacePlannerPageContent } from "./RacePlannerPageContent";

const title = "Planificateur de nutrition trail gratuit | Pace Yourself";
const description =
  "Préparez vos glucides, votre hydratation, votre sodium, votre allure et vos ravitaillements pour chaque segment de votre trail.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: RACE_PLANNER_PATH },
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

export default function RacePlannerPage() {
  return (
    <Suspense fallback={null}>
      <RacePlannerPageContent />
    </Suspense>
  );
}
