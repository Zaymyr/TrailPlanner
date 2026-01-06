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
        ? "border border-slate-800 bg-slate-900/50 text-slate-400"
        : "border border-emerald-900/60 bg-emerald-950/60 text-emerald-50",
      className,
    )}
  >
    {label}
  </span>
);
