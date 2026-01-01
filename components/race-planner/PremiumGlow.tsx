"use client";

import { cn } from "../utils";

type PremiumGlowProps = {
  tooltip?: string;
  className?: string;
};

export function PremiumGlow({ tooltip = "Premium feature", className }: PremiumGlowProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 rounded-md",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-md before:border before:border-amber-200/40 before:content-[''] before:opacity-70",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:bg-amber-300/10 after:blur-[4px] after:content-[''] after:opacity-60 after:animate-[pulse_3.4s_ease-in-out_infinite]",
        "transition duration-500 group-hover:before:opacity-90 group-hover:after:opacity-80 group-focus-visible:before:opacity-90 group-focus-visible:after:opacity-80",
        className
      )}
      aria-hidden
    >
      <span className="pointer-events-none absolute left-1/2 top-[-120%] -translate-x-1/2 rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-50 opacity-0 shadow-lg ring-1 ring-slate-700/70 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}
