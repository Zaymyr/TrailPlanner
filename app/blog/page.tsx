import type { Metadata, Route } from "next";
import Link from "next/link";

import { BlogCard } from "../../components/BlogCard";
import { TagBadge } from "../../components/TagBadge";
import { cn } from "../../components/utils";
import { getAllPosts, getAllTags, type CompiledPost, type TagSummary } from "../../lib/blog/posts";
import { buildLocaleMetaCopy, localeToOgLocale, SITE_URL } from "../seo";

export const dynamic = "force-static";

type BlogPageProps = {
  searchParams?: {
    tag?: string | string[];
  };
};

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = buildLocaleMetaCopy("en");
  const canonicalPath = "/blog";
  const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "TrailPlanner",
      locale: localeToOgLocale("en"),
      alternateLocale: [localeToOgLocale("fr")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const parseTagParam = (value: string | string[] | undefined): string | undefined => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
    return value[0].trim();
  }

  return undefined;
};

const filterPostsByTag = (posts: CompiledPost[], tag?: string): CompiledPost[] => {
  if (!tag) {
    return posts;
  }

  const normalized = tag.toLowerCase();
  return posts.filter((post) => post.meta.tags.some((postTag) => postTag.toLowerCase() === normalized));
};

const buildExcerpt = (description?: string): string =>
  description?.trim() ?? "A preview of this article will be available soon. Check back for more details.";

const TagFilter = ({ tags, activeTag }: { tags: TagSummary[]; activeTag?: string }) => {
  const renderTagLink = (tagLabel: string, targetTag?: string, count?: number) => {
    const isActive = activeTag?.toLowerCase() === targetTag?.toLowerCase();
    const href = targetTag
  ? {
      pathname: "/blog",
      query: { tag: targetTag },
    }
  : { pathname: "/blog" };


    return (
      <Link
        key={tagLabel}
        href={href}
        className={cn(
          "group inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
          isActive && "font-medium",
        )}
      >
        <TagBadge
          label={tagLabel}
          variant={isActive ? "default" : "muted"}
          className={cn(
            "group-hover:border-emerald-500 group-hover:text-emerald-100",
            isActive && "shadow-[0_0_0_1px_rgba(52,211,153,0.5)]",
          )}
        />
        {typeof count === "number" && <span className="text-xs text-slate-400">{count}</span>}
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {renderTagLink("All posts", undefined)}
      {tags.map((tag) => renderTagLink(tag.tag, tag.tag, tag.count))}
    </div>
  );
};

export default async function BlogIndex({ searchParams }: BlogPageProps) {
  const selectedTag = parseTagParam(searchParams?.tag);
  const [posts, tags] = await Promise.all([getAllPosts(), getAllTags()]);
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime(),
  );
  const visiblePosts = filterPostsByTag(sortedPosts, selectedTag);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-12 sm:px-6 lg:px-8">
      <header className="space-y-5">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Blog</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">Insights &amp; trail notes</h1>
          <p className="max-w-2xl text-base text-slate-300 sm:text-lg">
            Articles about fueling, pacing, and race planning from the TrailPlanner team.
          </p>
        </div>
        <TagFilter tags={tags} activeTag={selectedTag} />
      </header>

      {visiblePosts.length === 0 ? (
        <p className="text-sm text-slate-400">
          {selectedTag
            ? `No posts found for “${selectedTag}”.`
            : "No posts available yet. Check back soon!"}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visiblePosts.map((post) => (
            <BlogCard
              key={post.meta.slug}
              title={post.meta.title}
              description={buildExcerpt(post.meta.description)}
              href={`/blog/${post.meta.slug}` as Route}
              tags={post.meta.tags}
              date={post.meta.date}
              readingTime={post.meta.readingTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
