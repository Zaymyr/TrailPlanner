import type { ReactNode } from "react";

import { cn } from "../utils";

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  /** Primary way out of the empty state (a link or a button). */
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
};

/** Empty list or placeholder page: what is missing, why, and what to do next. */
export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center", className)}>
      {icon ? <div aria-hidden="true" className="text-muted-foreground">{icon}</div> : null}
      <div className="max-w-md space-y-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
