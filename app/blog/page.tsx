import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
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

const formatDate = (isoDate: string): string =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(isoDate));

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
    const href = targetTag ? `/blog?tag=${encodeURIComponent(targetTag)}` : "/blog";

    return (
      <Link
        key={tagLabel}
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition",
          isActive
            ? "border-emerald-400 bg-emerald-950/70 text-emerald-50 shadow-[0_0_0_1px_rgba(52,211,153,0.5)]"
            : "border-slate-800 text-slate-200 hover:border-emerald-400 hover:text-emerald-100",
        )}
      >
        <span className="font-medium">{tagLabel}</span>
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
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">Blog</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50">Insights &amp; trail notes</h1>
          <p className="max-w-2xl text-sm text-slate-300">
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
            <Card key={post.meta.slug} className="flex flex-col">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-xl leading-snug">
                    {post.meta.title}
                  </CardTitle>
                  <span className="whitespace-nowrap text-xs font-medium text-slate-400">
                    {formatDate(post.meta.date)}
                  </span>
                </div>
                <CardDescription className="text-sm text-slate-300">
                  {buildExcerpt(post.meta.description)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {post.meta.tags.length === 0 ? (
                    <span className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">
                      Untagged
                    </span>
                  ) : (
                    post.meta.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-emerald-900/70 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-100"
                      >
                        {tag}
                      </span>
                    ))
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>{post.meta.readingTime.minutes} min read</span>
                    <span aria-hidden="true">•</span>
                    <span>{post.meta.readingTime.words} words</span>
                  </div>
                  <Link href={`/blog/${post.meta.slug}`} className="text-emerald-300 hover:text-emerald-200">
                    Read post
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
