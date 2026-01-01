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
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-md after:border after:border-amber-100/40 after:content-[''] after:opacity-85",
        "transition duration-700 group-hover:after:opacity-100 group-focus-visible:after:opacity-100",
        className
      )}
      aria-hidden
    >
      <span
        className="absolute inset-0 rounded-[12px] opacity-70 animate-[spin_5s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(254,243,199,0.65), rgba(252,211,77,0.6), rgba(245,158,11,0.55), rgba(252,211,77,0.6), rgba(254,243,199,0.65))",
          padding: "1px",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <span className="pointer-events-none absolute left-1/2 top-[-120%] -translate-x-1/2 rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-semibold text-slate-50 opacity-0 shadow-lg ring-1 ring-slate-700/70 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        {tooltip}
      </span>
    </span>
  );
}
