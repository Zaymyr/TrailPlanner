import type { Metadata } from "next";

import { getAllPostMetadata } from "../lib/blog/posts";
import { loadPublishedOrganizerSocialProofs } from "../lib/organizer-social-proof-server";
import { CourseDiscoveryLinks } from "./courses/_components/CourseDiscoveryLinks";
import { LandingPage } from "./landing-page";
import { buildHomeStructuredData } from "./home-structured-data";
import { CANONICAL_PATH } from "./seo";

export const metadata: Metadata = {
  alternates: {
    canonical: CANONICAL_PATH,
    languages: {
      "fr-FR": CANONICAL_PATH,
      "x-default": CANONICAL_PATH,
    },
  },
};

type FeaturedGuideCard = {
  slug: string;
  title: string;
  excerpt: string;
  canonicalPath: string;
};

const buildExcerpt = (description?: string): string =>
  description?.trim() ?? "A preview of this article will be available soon. Check back for more details.";

const selectFeaturedGuides = async (): Promise<FeaturedGuideCard[]> => {
  // Never let a blog read failure take the home page down (it is the main crawl entry).
  const posts = await getAllPostMetadata().catch(() => []);

  return posts.slice(0, 4).map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: buildExcerpt(post.description),
    canonicalPath: post.canonicalPath,
  }));
};

export default async function HomePage() {
  const [featuredGuides, socialProofs] = await Promise.all([
    selectFeaturedGuides(),
    loadPublishedOrganizerSocialProofs(1),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildHomeStructuredData()).replace(/</g, "\\u003c"),
        }}
      />
      <LandingPage featuredGuides={featuredGuides} socialProofs={socialProofs} />
      <div className="px-4 pb-8 sm:px-6">
        <CourseDiscoveryLinks />
      </div>
    </>
  );
}
