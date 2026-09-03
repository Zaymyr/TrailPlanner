import type { ReactNode } from "react";

export function Accordion({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function AccordionItem({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-border py-4 last:border-b-0 first:pt-0 last:pb-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-lg font-semibold text-foreground marker:content-none">
        {title}
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        >
          <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">{children}</div>
    </details>
  );
}
