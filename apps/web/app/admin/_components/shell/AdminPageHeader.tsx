import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { EmptyState } from "../../../../components/ui/EmptyState";

/** Title row of a console page (h1, one-line description, actions on the right). */
export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A console route whose screen arrives in a later lot, with the way to today's screen. */
export function AdminPlaceholderPage({
  title,
  lot,
  description,
  links,
}: {
  title: string;
  lot: number;
  description: ReactNode;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <>
      <AdminPageHeader title={title} />
      <EmptyState
        title={`Écran prévu au lot ${lot}`}
        description={description}
        action={links.map((link) => (
          <Link
            key={link.href}
            href={link.href as Route}
            className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-brand hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {link.label}
          </Link>
        ))}
      />
    </>
  );
}
