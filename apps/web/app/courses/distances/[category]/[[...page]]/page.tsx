import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicRaces } from "../../../../../lib/public-races";
import { getDistanceLandingPage, getRacesForDistancePage, MIN_INDEXABLE_RACES } from "../../../../../lib/race-discovery";
import {
  buildLandingCrossLinks,
  buildLandingDescription,
  buildLandingTitle,
  getLandingPagePath,
  getLandingRaces,
  getTodayInFrance,
  paginateLandingRaces,
  parseLandingPageSegments,
} from "../../../../../lib/race-landing-pages";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../../../seo";
import { RaceLandingPage } from "../../../_components/RaceLandingPage";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = { params: { category: string; page?: string[] } };

export async function generateStaticParams() {
  return [];
}

const loadPage = async (params: PageProps["params"]) => {
  const page = getDistanceLandingPage(params.category);
  const pageNumber = parseLandingPageSegments(params.page);
  if (!page || pageNumber === null) return null;
  const allRaces = await getPublicRaces();
  const todayIso = getTodayInFrance();
  const races = getRacesForDistancePage(getLandingRaces(allRaces, todayIso), page);
  if (races.length < MIN_INDEXABLE_RACES) return null;
  const view = paginateLandingRaces(races, pageNumber);
  if (pageNumber > view.totalPages) return null;
  return { page, view, allRaces, todayIso };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const loaded = await loadPage(params);
  if (!loaded) return { title: "Sélection de courses introuvable", robots: { index: false, follow: false } };
  const { page, view } = loaded;
  const canonicalPath = getLandingPagePath(`/courses/distances/${page.slug}`, view.page);
  const title = buildLandingTitle([`${page.title} | Calendrier trail`, page.title], view.page);
  const description = buildLandingDescription(page.description, view.page);
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, type: "website", url: new URL(canonicalPath, SITE_URL), images: [DEFAULT_SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [DEFAULT_SOCIAL_IMAGE_PATH] },
  };
}

export default async function DistanceLandingRoute({ params }: PageProps) {
  const loaded = await loadPage(params);
  if (!loaded) notFound();
  const { page, view, allRaces, todayIso } = loaded;
  const basePath = `/courses/distances/${page.slug}`;
  return (
    <RaceLandingPage
      basePath={basePath}
      eyebrow="Calendrier par distance"
      heading={page.title}
      intro={page.description}
      breadcrumbLabel={page.shortLabel}
      view={view}
      crossLinks={buildLandingCrossLinks(allRaces, todayIso, basePath)}
    />
  );
}
