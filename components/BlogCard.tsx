import Image from "next/image";
import Link from "next/link";
import type { LinkProps } from "next/link";

import { formatBlogDate } from "../lib/blog/format";
import type { ReadingTime } from "../lib/blog/posts";
import { TagBadge } from "./TagBadge";
import { cn } from "./utils";

type BlogCardProps = {
  title: string;
  description?: string;
  href: LinkProps<string>["href"];
  tags: string[];
  date: string;
  readingTime?: ReadingTime;
  className?: string;
  imageSrc?: string;
  imageAlt?: string;
};

const buildDescription = (value?: string): string =>
  value?.trim() ?? "A preview of this article will be available soon. Check back for more details.";

export const BlogCard = ({
  title,
  description,
  href,
  tags,
  date,
  readingTime,
  className,
  imageSrc,
  imageAlt,
}: BlogCardProps) => {
  const hasTags = tags.length > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card/50 text-left transition hover:-translate-y-0.5 hover:border-[hsl(var(--brand))] hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand))] dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:focus-visible:outline-emerald-300",
        className,
      )}
    >
      {imageSrc ? (
        <div className="relative h-44 w-full bg-card/60 sm:h-48">
          <Image
            src={imageSrc}
            alt={imageAlt ?? title}
            fill
            className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.02]"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </div>
      ) : null}

      <div className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-[hsl(var(--brand))] dark:group-hover:text-emerald-100">
            {title}
          </h3>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatBlogDate(date)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground">
          {buildDescription(description)}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {readingTime ? (
              <>
                <span>{readingTime.minutes} min read</span>
                {readingTime.words ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{readingTime.words} words</span>
                  </>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {hasTags
              ? tags.map((tag) => <TagBadge key={tag} label={tag} />)
              : <TagBadge label="Untagged" variant="muted" />}
          </div>
        </div>
      </div>
    </Link>
  );
};
