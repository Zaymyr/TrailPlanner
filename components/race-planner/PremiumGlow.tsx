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
        "pointer-events-none absolute inset-0 rounded-md overflow-visible",
        className
      )}
      aria-hidden
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 120 44" preserveAspectRatio="none">
        <defs>
          <filter id="premium-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          x="2"
          y="2"
          width="116"
          height="40"
          rx="8"
          ry="8"
          fill="none"
          stroke="rgba(255, 214, 102, 0.35)"
          strokeWidth="2"
          className="premium-tracer"
          filter="url(#premium-glow)"
          strokeDasharray="28 220"
        />
      </svg>
      <span className="pointer-events-none absolute left-1/2 top-[-120%] -translate-x-1/2 rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-50 opacity-0 shadow-lg ring-1 ring-slate-700/70 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}
