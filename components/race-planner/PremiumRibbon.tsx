"use client";

import { cn } from "../utils";

type PremiumRibbonProps = {
  variant?: "corner" | "pill";
  label?: string;
  tooltip?: string;
  className?: string;
};

export function PremiumRibbon({
  variant = "corner",
  label = "PRO",
  tooltip = "Premium",
  className,
}: PremiumRibbonProps) {
  const tooltipStyles =
    "pointer-events-none absolute -right-1 top-6 select-none whitespace-nowrap rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-50 shadow-lg ring-1 ring-slate-700/70 opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100";

  if (variant === "pill") {
    return (
      <span className={cn("pointer-events-none absolute right-1 top-1 z-10", className)} role="presentation">
        <span className="inline-flex items-center rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-950 shadow-[0_4px_10px_rgba(0,0,0,0.28)] ring-1 ring-amber-100/70">
          {label}
        </span>
        <span className={tooltipStyles}>{tooltip}</span>
      </span>
    );
  }

  return (
    <span
      className={cn("pointer-events-none absolute -right-1.5 -top-1.5 z-10 h-6 w-6", className)}
      role="presentation"
    >
      <span className="absolute inset-0 rotate-45 rounded-md bg-amber-400/95 shadow-[0_4px_10px_rgba(0,0,0,0.3)] ring-1 ring-amber-100/70" />
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-950">
        {label}
      </span>
      <span className={tooltipStyles}>{tooltip}</span>
    </span>
  );
}
