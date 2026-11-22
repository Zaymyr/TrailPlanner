import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicRaces } from "../../../../../lib/public-races";
import { MIN_INDEXABLE_RACES } from "../../../../../lib/race-discovery";
import {
  buildLandingCrossLinks,
  buildLandingDescription,
  buildLandingTitle,
  getLandingPagePath,
  getLandingRaces,
  getRacesForMonth,
  getTodayInFrance,
  monthLandingCopy,
  paginateLandingRaces,
  parseLandingPageSegments,
  parseMonthSlug,
} from "../../../../../lib/race-landing-pages";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../../../seo";
import { RaceLandingPage } from "../../../_components/RaceLandingPage";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = { params: { month: string; page?: string[] } };

export async function generateStaticParams() {
  return [];
}

const loadPage = async (params: PageProps["params"]) => {
  const month = parseMonthSlug(params.month);
  const pageNumber = parseLandingPageSegments(params.page);
  if (!month || pageNumber === null) return null;
  const allRaces = await getPublicRaces();
  const todayIso = getTodayInFrance();
  // Only formats still to come: a month page disappears once it has passed.
  const races = getRacesForMonth(getLandingRaces(allRaces, todayIso), month);
  if (races.length < MIN_INDEXABLE_RACES) return null;
  const view = paginateLandingRaces(races, pageNumber);
  if (pageNumber > view.totalPages) return null;
  return { month, view, allRaces, todayIso, copy: monthLandingCopy(month, races.length) };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const loaded = await loadPage(params);
  if (!loaded) return { title: "Sélection de courses introuvable", robots: { index: false, follow: false } };
  const { month, view, copy } = loaded;
  const canonicalPath = getLandingPagePath(`/courses/mois/${month.slug}`, view.page);
  const title = buildLandingTitle(copy.titleCandidates, view.page);
  const description = buildLandingDescription(copy.description, view.page);
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, type: "website", url: new URL(canonicalPath, SITE_URL), images: [DEFAULT_SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_SOCIAL_IMAGE_PATH] },
  };
}

export default async function MonthLandingRoute({ params }: PageProps) {
  const loaded = await loadPage(params);
  if (!loaded) notFound();
  const { month, view, allRaces, todayIso, copy } = loaded;
  const basePath = `/courses/mois/${month.slug}`;
  return (
    <RaceLandingPage
      basePath={basePath}
      eyebrow="Calendrier par mois"
      heading={copy.heading}
      intro={copy.description}
      breadcrumbLabel={month.label.charAt(0).toUpperCase() + month.label.slice(1)}
      view={view}
      crossLinks={buildLandingCrossLinks(allRaces, todayIso, basePath)}
    />
  );
}
