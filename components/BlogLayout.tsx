import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import Script from "next/script";

import type { CompiledPost, PostMeta } from "../lib/blog/posts";
import { formatBlogDate } from "../lib/blog/format";
import { RACE_PLANNER_PATH, SITE_URL } from "../app/seo";
import { BlogCard } from "./BlogCard";
import { Prose } from "./Prose";
import { TagBadge } from "./TagBadge";
import { TOC } from "./TOC";

type BlogLayoutProps = {
  post: CompiledPost;
  canonicalUrl: string;
  relatedPosts: PostMeta[];
};

const formatUpdatedAt = (isoDate?: string): string | undefined =>
  isoDate ? formatBlogDate(isoDate) : undefined;

const buildJsonLd = (post: CompiledPost, canonicalUrl: string) => ({
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  headline: post.meta.title,
  description: post.meta.description,
  datePublished: post.meta.date,
  dateModified: post.meta.updatedAt ?? post.meta.date,
  url: canonicalUrl,
  mainEntityOfPage: canonicalUrl,
  inLanguage: "en",
  wordCount: post.meta.readingTime.words,
  keywords: post.meta.tags,
  articleBody: post.body,
  image: post.meta.image ? new URL(post.meta.image, SITE_URL).toString() : undefined,
  author: {
    "@type": "Organization",
    name: "TrailPlanner",
    url: SITE_URL,
  },
  publisher: {
    "@type": "Organization",
    name: "TrailPlanner",
    url: SITE_URL,
  },
});

const TagList = ({ tags }: { tags: string[] }) => {
  if (tags.length === 0) {
    return <TagBadge label="Untagged" variant="muted" />;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <TagBadge key={tag} label={tag} />
      ))}
    </div>
  );
};

export const BlogLayout = ({ post, canonicalUrl, relatedPosts }: BlogLayoutProps) => {
  const lastUpdated = formatUpdatedAt(post.meta.updatedAt);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-12 sm:px-6 lg:px-8">
      <header className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-sm shadow-emerald-900/30 sm:p-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">Trailplanner blog</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">{post.meta.title}</h1>
          {post.meta.description && (
            <p className="max-w-3xl text-base text-slate-200 sm:text-lg">{post.meta.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>Published {formatBlogDate(post.meta.date)}</span>
          {lastUpdated && (
            <>
              <span aria-hidden="true">•</span>
              <span>Last updated {lastUpdated}</span>
            </>
          )}
          <span aria-hidden="true">•</span>
          <span>{post.meta.readingTime.minutes} min read</span>
          <span aria-hidden="true">•</span>
          <span>{post.meta.readingTime.words} words</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <TagList tags={post.meta.tags} />
          <Link
            href={RACE_PLANNER_PATH}
            className="inline-flex items-center justify-center rounded-md border border-emerald-400/70 bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            Plan your next race
          </Link>
        </div>

        {post.meta.image ? (
          <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/60">
            <div className="relative h-64 w-full sm:h-72 lg:h-80">
              <Image
                src={post.meta.image}
                alt={post.meta.imageAlt ?? post.meta.title}
                fill
                priority
                className="h-full w-full object-cover"
                sizes="(min-width: 1280px) 960px, (min-width: 1024px) 720px, 100vw"
              />
            </div>
          </div>
        ) : null}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-8">
          {post.headings.length > 0 && (
            <div className="lg:hidden">
              <TOC headings={post.headings} />
            </div>
          )}

          <Prose>{post.content}</Prose>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
            <p>
              Looking for a tailored fueling plan? Our race planner helps you calculate aid-station timing and
              nutrition targets in minutes.
            </p>
            <Link
              href={RACE_PLANNER_PATH}
              className="mt-3 inline-flex items-center gap-2 text-emerald-200 hover:text-emerald-100"
            >
              Build your race plan →
            </Link>
          </div>
        </div>

        {post.headings.length > 0 && (
          <div className="hidden lg:block lg:space-y-4">
            <TOC headings={post.headings} />
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-50">Related posts</h2>
          <Link href="/blog" className="text-sm text-emerald-200 hover:text-emerald-100">
            View all
          </Link>
        </div>
        {relatedPosts.length === 0 ? (
          <p className="text-sm text-slate-400">More articles are on the way. Check back soon!</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {relatedPosts.map((related) => (
              <BlogCard
                key={related.slug}
                title={related.title}
              description={related.description}
              href={`/blog/${related.slug}` as Route}
              tags={related.tags}
              date={related.date}
              readingTime={related.readingTime}
              imageSrc={related.image}
              imageAlt={related.imageAlt}
            />
          ))}
        </div>
      )}
    </section>

      <Script
        id={`blog-json-ld-${post.meta.slug}`}
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(post, canonicalUrl)) }}
      />
    </div>
  );
};
