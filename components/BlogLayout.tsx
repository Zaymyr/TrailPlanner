import Image from "next/image";
import Link from "next/link";
import Script from "next/script";

import type { CompiledPost } from "../lib/blog/posts";
import { formatBlogDate } from "../lib/blog/format";
import { RACE_PLANNER_PATH, SITE_URL } from "../app/seo";
import { Prose } from "./Prose";
import { TagBadge } from "./TagBadge";
import { TOC } from "./TOC";
import { RelatedPosts } from "./blog/RelatedPosts";

type BlogLayoutProps = {
  post: CompiledPost;
  canonicalUrl: string;
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
    name: "Pace Yourself",
    url: SITE_URL,
  },
  publisher: {
    "@type": "Organization",
    name: "Pace Yourself",
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

export const BlogLayout = ({ post, canonicalUrl }: BlogLayoutProps) => {
  const lastUpdated = formatUpdatedAt(post.meta.updatedAt);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-12 sm:px-6 lg:px-8">
      <header className="space-y-5 rounded-2xl border border-border bg-card/60 p-6 shadow-sm shadow-emerald-900/30 sm:p-8">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.25em] text-[hsl(var(--success))] dark:text-emerald-300">
            Pace Yourself blog
          </p>
          <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{post.meta.title}</h1>
          {post.meta.description && (
            <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">{post.meta.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
            className="inline-flex items-center justify-center rounded-md border border-[hsl(var(--brand))] bg-[hsl(var(--brand))] px-4 py-2 text-sm font-semibold text-[hsl(var(--brand-foreground))] transition hover:bg-[hsl(var(--brand)/0.9)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] dark:border-emerald-400/70 dark:bg-emerald-500 dark:text-foreground dark:hover:bg-emerald-400 dark:focus-visible:outline-emerald-300"
          >
            Plan your next race
          </Link>
        </div>

        {post.meta.image ? (
          <div className="overflow-hidden rounded-xl border border-border/80 bg-card/60">
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

          <div className="rounded-xl border border-border bg-card/50 p-5 text-sm text-muted-foreground">
            <p>
              Looking for a tailored fueling plan? Our race planner helps you calculate aid-station timing and
              nutrition targets in minutes.
            </p>
            <Link
              href={RACE_PLANNER_PATH}
              className="mt-3 inline-flex items-center gap-2 text-[hsl(var(--success))] hover:text-[hsl(var(--brand))] dark:text-emerald-200 dark:hover:text-emerald-100"
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

      <RelatedPosts slug={post.meta.slug} />

      <Script
        id={`blog-json-ld-${post.meta.slug}`}
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(post, canonicalUrl)) }}
      />
    </div>
  );
};
