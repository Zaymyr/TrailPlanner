import type { ReactNode } from "react";

export function Accordion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function AccordionItem({
  title,
  icon,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-border py-4 last:border-b-0 first:pt-0 last:pb-0"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 marker:content-none">
        <span className="flex items-start gap-3">
          {icon ? <span className="mt-0.5 shrink-0 text-brand" aria-hidden="true">{icon}</span> : null}
          <span>
            <span className="block text-lg font-semibold text-foreground">{title}</span>
            {summary ? <span className="mt-0.5 block text-sm font-normal text-muted-foreground group-open:hidden">{summary}</span> : null}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </details>
  );
}
