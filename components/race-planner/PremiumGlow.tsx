"use client";

import { cn } from "../utils";

type PremiumGlowProps = {
  className?: string;
};

export function PremiumGlow({ className }: PremiumGlowProps) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 rounded-md",
        className
      )}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-md ring-1 ring-amber-200/50" />
      <span className="absolute inset-0 rounded-md bg-amber-300/10 blur-[2px] opacity-0 transition-opacity duration-500 group-hover:opacity-70 group-focus-visible:opacity-70" />
      <span className="absolute inset-0 rounded-md bg-amber-300/8 blur-sm opacity-60 animate-[pulse_3s_ease-in-out_infinite]" />
    </span>
  );
}
