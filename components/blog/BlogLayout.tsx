import Link from "next/link";
import Script from "next/script";

import type { CompiledPost, PostMeta } from "../../lib/blog/posts";
import { RACE_PLANNER_PATH, SITE_URL } from "../../app/seo";

type BlogLayoutProps = {
  post: CompiledPost;
  canonicalUrl: string;
  relatedPosts: PostMeta[];
};

const formatDate = (isoDate: string): string =>
  new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(isoDate));

const formatUpdatedAt = (isoDate?: string): string | undefined =>
  isoDate ? formatDate(isoDate) : undefined;

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

const TableOfContents = ({ headings }: { headings: CompiledPost["headings"] }) => {
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className="rounded-lg border border-slate-800 bg-slate-900/40 p-5 shadow-sm shadow-emerald-900/30">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">On this page</p>
      <ul className="space-y-2 text-sm">
        {headings.map((heading) => (
          <li
            key={`${heading.id}-${heading.text}`}
            className={heading.level === 3 ? "ml-3 border-l border-emerald-900/40 pl-3" : undefined}
          >
            <a href={`#${heading.id}`} className="text-emerald-200 hover:text-emerald-100">
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};

const TagList = ({ tags }: { tags: string[] }) => (
  <div className="flex flex-wrap gap-2">
    {tags.length === 0 ? (
      <span className="rounded-full border border-slate-800 px-3 py-1 text-xs text-slate-400">Untagged</span>
    ) : (
      tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-emerald-900/60 bg-emerald-950/60 px-3 py-1 text-xs font-medium text-emerald-100"
        >
          {tag}
        </span>
      ))
    )}
  </div>
);

export const BlogLayout = ({ post, canonicalUrl, relatedPosts }: BlogLayoutProps) => {
  const lastUpdated = formatUpdatedAt(post.meta.updatedAt);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <header className="space-y-5 rounded-lg border border-slate-800 bg-slate-900/50 p-6 shadow shadow-emerald-900/30">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Trailplanner blog</p>
          <h1 className="text-3xl font-semibold leading-tight text-slate-50">{post.meta.title}</h1>
          {post.meta.description && (
            <p className="max-w-3xl text-base text-slate-200">{post.meta.description}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span>Published {formatDate(post.meta.date)}</span>
          {lastUpdated && (
            <>
              <span aria-hidden="true">•</span>
              <span>Last updated {lastUpdated}</span>
            </>
          )}
          <span aria-hidden="true">•</span>
          <span>
            {post.meta.readingTime.minutes} min read • {post.meta.readingTime.words} words
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TagList tags={post.meta.tags} />
          <Link
            href={RACE_PLANNER_PATH}
            className="inline-flex items-center justify-center rounded-md border border-emerald-400/70 bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            Plan your next race
          </Link>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(240px,1fr)]">
        <div className="space-y-8">
          <article className="blog-prose">
            {post.content}
          </article>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
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
          <div className="space-y-4 lg:sticky lg:top-6">
            <TableOfContents headings={post.headings} />
          </div>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
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
              <Link
                key={related.slug}
                href={`/blog/${related.slug}`}
                className="group rounded-lg border border-slate-800 bg-slate-900/40 p-4 transition hover:border-emerald-700 hover:bg-emerald-950/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-50 group-hover:text-emerald-100">
                    {related.title}
                  </h3>
                  <span className="whitespace-nowrap text-xs text-slate-400">{formatDate(related.date)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {related.description ?? "A preview of this article will be available soon."}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>{related.readingTime.minutes} min read</span>
                  <TagList tags={related.tags} />
                </div>
              </Link>
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
