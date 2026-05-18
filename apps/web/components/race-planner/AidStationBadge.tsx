import { AidStationIcon } from "@pace-yourself/design-system";
import type { ComponentPropsWithoutRef } from "react";

const variantStyleMap = {
  start: {
    shell:
      "border-emerald-300/80 bg-gradient-to-br from-white via-emerald-50 to-lime-100 text-emerald-700 shadow-[0_10px_24px_rgba(16,185,129,0.18)] dark:border-emerald-400/50 dark:from-slate-950 dark:via-emerald-950/80 dark:to-slate-900 dark:text-emerald-100",
    glow: "bg-emerald-500/10 dark:bg-emerald-300/10",
    glyph:
      "bg-emerald-600 text-white shadow-[0_6px_14px_rgba(5,150,105,0.28)] dark:bg-emerald-400 dark:text-emerald-950",
    step:
      "border-emerald-200 bg-white text-emerald-950 dark:border-emerald-300/40 dark:bg-slate-950 dark:text-emerald-100",
  },
  ravito: {
    shell:
      "border-sky-300/80 bg-gradient-to-br from-white via-sky-50 to-emerald-50 text-sky-700 shadow-[0_10px_24px_rgba(14,165,233,0.16)] dark:border-sky-400/50 dark:from-slate-950 dark:via-sky-950/80 dark:to-emerald-950/80 dark:text-sky-100",
    glow: "bg-sky-500/10 dark:bg-sky-300/10",
    glyph:
      "bg-sky-600 text-white shadow-[0_6px_14px_rgba(2,132,199,0.28)] dark:bg-sky-300 dark:text-sky-950",
    step:
      "border-sky-200 bg-white text-sky-950 dark:border-sky-300/40 dark:bg-slate-950 dark:text-sky-100",
  },
} as const;

type AidStationBadgeProps = ComponentPropsWithoutRef<"div"> & {
  step: number;
  variant: keyof typeof variantStyleMap;
};

type GlyphProps = {
  className?: string;
};

function StartFlagGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 20V4"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d="M8 5.5h8.6c.8 0 1.2.9.7 1.5l-1.5 2 1.5 2c.5.6.1 1.5-.7 1.5H8"
        fill="currentColor"
      />
      <path
        d="M5.5 20h4"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RavitoGlyph({ className }: GlyphProps) {
  return <AidStationIcon size={24} className={className} />;
}

export function AidStationBadge({ step, variant, className, ...props }: AidStationBadgeProps) {
  const styles = variantStyleMap[variant];
  const Glyph = variant === "start" ? StartFlagGlyph : RavitoGlyph;

  return (
    <div
      className={[
        "relative inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border p-1 sm:h-14 sm:w-14 md:h-16 md:w-16",
        styles.shell,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span className={["absolute inset-1 rounded-xl", styles.glow].join(" ")} aria-hidden="true" />
      <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-current opacity-35" aria-hidden="true" />
      <span
        className={[
          "relative flex h-10 w-10 items-center justify-center rounded-xl sm:h-9 sm:w-9 md:h-10 md:w-10",
          styles.glyph,
        ]
          .filter(Boolean)
          .join(" ")}
        aria-hidden="true"
      >
        <Glyph className="h-6 w-6 sm:h-5 sm:w-5 md:h-6 md:w-6" />
      </span>
      <span
        className={[
          "absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-bold leading-none shadow-sm",
          styles.step,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {step}
      </span>
    </div>
  );
}
