import type { Metadata } from "next";
import { Suspense } from "react";

import {
  DEFAULT_SOCIAL_IMAGE,
  DEFAULT_SOCIAL_IMAGE_PATH,
  localeToOgLocale,
  RACE_PLANNER_PATH,
  RACE_PLANNER_URL,
  SITE_URL,
} from "../../seo";
import { RacePlannerPageContent } from "./RacePlannerPageContent";
import { PLANNER_META_DESCRIPTION, plannerFallback, plannerStructuredData } from "./planner-seo";

const title = "Planificateur de nutrition trail gratuit | Pace Yourself";
const description = PLANNER_META_DESCRIPTION;

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
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", title, description, images: [DEFAULT_SOCIAL_IMAGE_PATH] },
};

export default function RacePlannerPage() {
  return (
    <>
      <script
        id="software-application-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(plannerStructuredData) }}
      />
      <Suspense fallback={plannerFallback}>
        <RacePlannerPageContent />
      </Suspense>
    </>
  );
}
