import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicRaces } from "../../../../../lib/public-races";
import { MIN_INDEXABLE_RACES } from "../../../../../lib/race-discovery";
import {
  buildLandingCrossLinks,
  buildLandingDescription,
  buildLandingTitle,
  getFrenchRegionBySlug,
  getLandingPagePath,
  getLandingRaces,
  getRacesForRegion,
  getTodayInFrance,
  paginateLandingRaces,
  parseLandingPageSegments,
  regionLandingCopy,
} from "../../../../../lib/race-landing-pages";
import { DEFAULT_SOCIAL_IMAGE, DEFAULT_SOCIAL_IMAGE_PATH, SITE_URL } from "../../../../seo";
import { RaceLandingPage } from "../../../_components/RaceLandingPage";

export const revalidate = 3600;
export const dynamicParams = true;

type PageProps = { params: { region: string; page?: string[] } };

export async function generateStaticParams() {
  return [];
}

const loadPage = async (params: PageProps["params"]) => {
  const region = getFrenchRegionBySlug(params.region);
  const pageNumber = parseLandingPageSegments(params.page);
  if (!region || pageNumber === null) return null;
  const allRaces = await getPublicRaces();
  const todayIso = getTodayInFrance();
  const races = getRacesForRegion(getLandingRaces(allRaces, todayIso), region);
  if (races.length < MIN_INDEXABLE_RACES) return null;
  const view = paginateLandingRaces(races, pageNumber);
  if (pageNumber > view.totalPages) return null;
  return { region, view, allRaces, todayIso, copy: regionLandingCopy(region, races.length) };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const loaded = await loadPage(params);
  if (!loaded) return { title: "Sélection de courses introuvable", robots: { index: false, follow: false } };
  const { region, view, copy } = loaded;
  const canonicalPath = getLandingPagePath(`/courses/regions/${region.slug}`, view.page);
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

export default async function RegionLandingRoute({ params }: PageProps) {
  const loaded = await loadPage(params);
  if (!loaded) notFound();
  const { region, view, allRaces, todayIso, copy } = loaded;
  const basePath = `/courses/regions/${region.slug}`;
  return (
    <RaceLandingPage
      basePath={basePath}
      eyebrow="Calendrier par région"
      heading={copy.heading}
      intro={copy.description}
      breadcrumbLabel={region.label}
      view={view}
      crossLinks={buildLandingCrossLinks(allRaces, todayIso, basePath)}
    />
  );
}
