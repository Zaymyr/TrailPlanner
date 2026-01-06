import type { PostHeading } from "../lib/blog/posts";

type TOCProps = {
  headings: PostHeading[];
  title?: string;
};

export const TOC = ({ headings, title = "On this page" }: TOCProps) => {
  if (!headings.length) {
    return null;
  }

  return (
    <nav className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm shadow-emerald-900/30">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">{title}</p>
      <ul className="space-y-2 text-sm text-slate-200">
        {headings.map((heading) => (
          <li
            key={`${heading.id}-${heading.text}`}
            className={heading.level === 3 ? "ml-3 border-l border-emerald-900/40 pl-3" : undefined}
          >
            <a href={`#${heading.id}`} className="hover:text-emerald-100">
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
