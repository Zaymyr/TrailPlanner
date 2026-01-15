import Link from "next/link";

import { getRelatedPosts } from "../../content/blog/index-helpers";

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

type RelatedPostsProps = {
  slug: string;
  limit?: number;
  title?: string;
};

export const RelatedPosts = ({ slug, limit = 4, title = "À lire aussi" }: RelatedPostsProps) => {
  const relatedPosts = getRelatedPosts(slug, limit);

  if (relatedPosts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {relatedPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex h-full flex-col justify-between rounded-xl border border-border/80 bg-card/60 p-4 transition hover:border-[hsl(var(--brand))]"
          >
            <div className="space-y-3">
              <p className="text-base font-semibold text-foreground transition group-hover:text-[hsl(var(--brand))]">
                {post.title}
              </p>
              <div className="flex flex-wrap gap-2">
                {post.topics.slice(0, 3).map((topic) => (
                  <span
                    key={`${post.slug}-${topic}`}
                    className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
            <span className="mt-4 inline-flex w-fit rounded-full bg-[hsl(var(--brand)/0.12)] px-2.5 py-1 text-xs font-semibold text-[hsl(var(--brand))]">
              {LEVEL_LABELS[post.level] ?? post.level}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
