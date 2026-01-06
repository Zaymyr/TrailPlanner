import Link from "next/link";

import { formatBlogDate } from "../lib/blog/format";
import type { ReadingTime } from "../lib/blog/posts";
import { TagBadge } from "./TagBadge";
import { cn } from "./utils";

type BlogCardProps = {
  title: string;
  description?: string;
  href: string;
  tags: string[];
  date: string;
  readingTime?: ReadingTime;
  className?: string;
};

const buildDescription = (value?: string): string =>
  value?.trim() ?? "A preview of this article will be available soon. Check back for more details.";

export const BlogCard = ({ title, description, href, tags, date, readingTime, className }: BlogCardProps) => {
  const hasTags = tags.length > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-700 hover:bg-emerald-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold leading-snug text-slate-50 group-hover:text-emerald-100">{title}</h3>
        <span className="whitespace-nowrap text-xs text-slate-400">{formatBlogDate(date)}</span>
      </div>
      <p className="text-sm text-slate-300">{buildDescription(description)}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {readingTime && (
            <>
              <span>{readingTime.minutes} min read</span>
              {readingTime.words ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span>{readingTime.words} words</span>
                </>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {hasTags
            ? tags.map((tag) => <TagBadge key={tag} label={tag} />)
            : <TagBadge label="Untagged" variant="muted" />}
        </div>
      </div>
    </Link>
  );
};
