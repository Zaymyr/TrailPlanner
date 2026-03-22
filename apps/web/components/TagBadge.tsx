import { cn } from "./utils";

type TagBadgeProps = {
  label: string;
  variant?: "default" | "muted";
  className?: string;
};

export const TagBadge = ({ label, variant = "default", className }: TagBadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
      variant === "muted"
        ? "border border-border bg-muted text-muted-foreground dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400"
        : "border border-[hsl(var(--brand))]/40 bg-[hsl(var(--brand)/0.12)] text-[hsl(var(--success))] dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-50",
      className,
    )}
  >
    {label}
  </span>
);
