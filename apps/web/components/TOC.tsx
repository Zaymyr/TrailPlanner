import type { PostHeading } from "../lib/blog/posts";

type TOCProps = {
  headings: PostHeading[];
  title?: string;
  /** Renders the list inside a <details> element, closed by default (mobile). */
  collapsible?: boolean;
};

export const TOC = ({ headings, title = "Sur cette page", collapsible = false }: TOCProps) => {
  if (!headings.length) {
    return null;
  }

  const list = (
    <ul className="space-y-2 text-sm text-muted-foreground dark:text-slate-200">
      {headings.map((heading) => (
        <li
          key={`${heading.id}-${heading.text}`}
          className={
            heading.level === 3 ? "ml-3 border-l border-border pl-3 dark:border-emerald-900/40" : undefined
          }
        >
          <a href={`#${heading.id}`} className="hover:text-foreground dark:hover:text-emerald-100">
            {heading.text}
          </a>
        </li>
      ))}
    </ul>
  );
  const titleClass = "text-xs font-semibold uppercase tracking-[0.18em] text-foreground dark:text-emerald-200";

  return (
    <nav className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:shadow-emerald-900/30">
      {collapsible ? (
        <details>
          <summary className={`cursor-pointer ${titleClass}`}>{title}</summary>
          <div className="mt-3">{list}</div>
        </details>
      ) : (
        <>
          <p className={`mb-3 ${titleClass}`}>{title}</p>
          {list}
        </>
      )}
    </nav>
  );
};
