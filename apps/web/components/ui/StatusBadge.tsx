import type { ReactNode } from "react";

import { cn } from "../utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<StatusTone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-stone-100 text-stone-700 dark:bg-slate-800 dark:text-slate-200", dot: "bg-stone-400" },
  info: { badge: "bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-100", dot: "bg-blue-500" },
  success: { badge: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-100", dot: "bg-emerald-600" },
  warning: { badge: "bg-orange-50 text-orange-800 dark:bg-orange-950/60 dark:text-orange-100", dot: "bg-orange-500" },
  danger: { badge: "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-100", dot: "bg-red-500" },
};

type StatusBadgeProps = {
  tone?: StatusTone;
  children: ReactNode;
  /** Coloured dot before the label (default true). */
  dot?: boolean;
  /** Pulsing dot for something running (render, publication in progress). */
  pulse?: boolean;
  className?: string;
  title?: string;
};

/** One status pill for every admin list: the tone carries the colour, the text carries the meaning. */
export function StatusBadge({ tone = "neutral", children, dot = true, pulse = false, className, title }: StatusBadgeProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", classes.badge, className)}
    >
      {dot ? <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", classes.dot, pulse && "animate-pulse")} /> : null}
      {children}
    </span>
  );
}
