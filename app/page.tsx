import { getAllPostMetadata } from "../lib/blog/posts";
import { LandingPage } from "./landing-page";

type FeaturedGuideCard = {
  slug: string;
  title: string;
  excerpt: string;
};

const buildExcerpt = (description?: string): string =>
  description?.trim() ?? "A preview of this article will be available soon. Check back for more details.";

const selectFeaturedGuides = async (): Promise<FeaturedGuideCard[]> => {
  const posts = await getAllPostMetadata();

  return posts.slice(0, 4).map((post) => ({
    slug: post.slug,
    title: post.title,
    excerpt: buildExcerpt(post.description),
  }));
};

export default async function HomePage() {
  const featuredGuides = await selectFeaturedGuides();

  return <LandingPage featuredGuides={featuredGuides} />;
}
