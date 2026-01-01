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
        "before:pointer-events-none before:absolute before:-inset-[1px] before:rounded-[12px] before:bg-[conic-gradient(at_top,_#fef3c7,_#fcd34d,_#f59e0b,_#fcd34d,_#fef3c7)] before:blur-[4px] before:opacity-55 before:content-[''] before:animate-[spin_7s_linear_infinite]",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:border after:border-amber-100/40 after:content-[''] after:opacity-80",
        "transition duration-700 group-hover:before:opacity-75 group-hover:after:opacity-90 group-focus-visible:before:opacity-75 group-focus-visible:after:opacity-90",
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
