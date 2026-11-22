import * as React from "react";

import { cn } from "../utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Native `<select>` with the input styling and a chevron; keeps the browser's keyboard and mobile pickers. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <div className={cn("relative min-w-0", className)}>
    <select
      ref={ref}
      className="h-10 w-full min-w-0 appearance-none rounded-md border border-input bg-card py-2 pl-3 pr-9 text-sm text-foreground transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
      {...props}
    >
      {children}
    </select>
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    >
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
));

Select.displayName = "Select";
