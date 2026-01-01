"use client";

import { cn } from "../utils";

type PremiumRibbonProps = {
  className?: string;
};

export function PremiumRibbon({ className }: PremiumRibbonProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-1 -right-1 h-5 w-5 overflow-hidden",
        className
      )}
      aria-hidden
    >
      <span className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-amber-500 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
      <span className="absolute right-[3px] top-[2px] text-[10px] font-bold text-white drop-shadow">
        ★
      </span>
    </span>
  );
}
