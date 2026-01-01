"use client";

import { cn } from "../utils";

type PremiumMarkProps = {
  className?: string;
  icon?: React.ReactNode;
};

export function PremiumMark({ className, icon }: PremiumMarkProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute right-0.5 top-0.5 h-4 w-4 rounded-lg border border-amber-300/40 bg-amber-300/20 text-amber-200 shadow-[0_2px_6px_rgba(0,0,0,0.25)]",
        "flex items-center justify-center",
        className
      )}
      aria-hidden
    >
      {icon ?? <span className="text-[10px] leading-none">★</span>}
    </span>
  );
}
