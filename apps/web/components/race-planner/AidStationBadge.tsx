import type { ComponentPropsWithoutRef } from "react";
import { AidStationIcon } from "@pace-yourself/design-system/icons";

/**
 * Course marker of the race plan (and of the organizer aid-station editor): a round trail post on the
 * dotted rail. Departure and finish are solid forest posts, aid stations are cream posts ringed in forest.
 * The small mono tab carries the point number.
 */
const variantStyleMap = {
  start: {
    post: "bg-[#2D5016] text-[#FAF8F2] ring-[#2D5016]",
    tab: "bg-[#FAF8F2] text-[#2D5016] ring-[#2D5016]/30",
  },
  ravito: {
    post: "bg-[#FAF8F2] text-[#2D5016] ring-[#2D5016]",
    tab: "bg-[#2D5016] text-[#FAF8F2] ring-[#FAF8F2]",
  },
  finish: {
    post: "bg-[#1F3810] text-[#C8D44E] ring-[#1F3810]",
    tab: "bg-[#C8D44E] text-[#1F3810] ring-[#FAF8F2]",
  },
} as const;

type AidStationBadgeProps = ComponentPropsWithoutRef<"div"> & {
  step: number;
  variant: keyof typeof variantStyleMap;
};

/** Start arch: two posts and the banner runners pass under. */
function StartArchGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M5.5 20.5V6.5M18.5 20.5V6.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <rect x="4" y="4.5" width="16" height="5.5" rx="1.4" stroke="currentColor" strokeWidth={1.7} />
      <path d="M8.5 7.25h7" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeDasharray="1.6 1.8" />
    </svg>
  );
}

function FinishFlagGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M6 21V4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      <path d="M6.8 4.5h11.4v8.6H6.8z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M6.8 4.5h3.8v2.9H6.8zM14.4 4.5h3.8v2.9h-3.8zM10.6 7.4h3.8v2.9h-3.8zM6.8 10.3h3.8v2.8H6.8zM14.4 10.3h3.8v2.8h-3.8z" fill="currentColor" />
    </svg>
  );
}

export function AidStationBadge({ step, variant, className, ...props }: AidStationBadgeProps) {
  const styles = variantStyleMap[variant];

  return (
    <div
      className={["relative inline-flex h-12 w-12 shrink-0 items-center justify-center", className].filter(Boolean).join(" ")}
      {...props}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ring-2 shadow-[0_2px_0_rgba(31,36,16,0.12)] ${styles.post}`}
        aria-hidden="true"
      >
        {variant === "ravito" ? (
          <AidStationIcon size={24} strokeWidth={1.9} />
        ) : variant === "start" ? (
          <StartArchGlyph className="h-[22px] w-[22px]" />
        ) : (
          <FinishFlagGlyph className="h-[22px] w-[22px]" />
        )}
      </span>
      <span
        className={`absolute -bottom-1 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-[family-name:var(--font-plan-mono)] text-[10px] font-bold leading-none tabular-nums ring-2 ${styles.tab}`}
      >
        {step}
      </span>
    </div>
  );
}
