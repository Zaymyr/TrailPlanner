import type { ComponentPropsWithoutRef } from "react";

const variantStyleMap = {
  start: {
    shell:
      "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-100",
    step:
      "border-emerald-200 bg-white text-emerald-800 dark:border-emerald-400/40 dark:bg-slate-950 dark:text-emerald-100",
  },
  ravito: {
    shell:
      "border-border bg-muted/60 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100",
    step:
      "border-border bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100",
  },
  finish: {
    shell:
      "border-emerald-400 bg-emerald-100 text-emerald-800 shadow-sm dark:border-emerald-400/60 dark:bg-emerald-500/15 dark:text-emerald-100",
    step:
      "border-emerald-300 bg-white text-emerald-800 dark:border-emerald-400/40 dark:bg-slate-950 dark:text-emerald-100",
  },
} as const;

type AidStationBadgeProps = ComponentPropsWithoutRef<"div"> & {
  step: number;
  variant: keyof typeof variantStyleMap;
};

type GlyphProps = {
  className?: string;
};

function StartSignGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 27V5M25 27V5"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M4.5 6.5h23v10h-23z"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinejoin="round"
      />
      <text x="16" y="13.8" fill="currentColor" textAnchor="middle" fontSize="5.7" fontWeight="900">
        START
      </text>
      <path
        d="M4 27h24"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function RavitoPumpGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 27V7.5A2.5 2.5 0 0 1 10.5 5h9A2.5 2.5 0 0 1 22 7.5V27"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.5 8.5h7v6.5h-7z"
        stroke="currentColor"
        strokeWidth={2.1}
        strokeLinejoin="round"
      />
      <path
        d="M22 10h2.4l2.6 3v9.2c0 2.2-1.2 3.8-3.2 3.8s-3.2-1.6-3.2-3.8v-3"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25 13v4"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d="M6 27h18"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function FinishFlagGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 27V5"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <path
        d="M9 6h15v13H9z"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <path d="M10 7h4.7v4.2H10zM19.3 7H24v4.2h-4.7zM14.7 11.2h4.6v4.2h-4.6zM10 15.4h4.7V18H10zM19.3 15.4H24V18h-4.7z" fill="currentColor" />
      <path
        d="M6 27h6"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

const variantGlyphMap = {
  start: StartSignGlyph,
  ravito: RavitoPumpGlyph,
  finish: FinishFlagGlyph,
} as const;

export function AidStationBadge({ step, variant, className, ...props }: AidStationBadgeProps) {
  const styles = variantStyleMap[variant];
  const Glyph = variantGlyphMap[variant];

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
      <span
        className="relative flex h-10 w-10 items-center justify-center sm:h-9 sm:w-9 md:h-10 md:w-10"
        aria-hidden="true"
      >
        <Glyph className="h-7 w-7 sm:h-6 sm:w-6 md:h-7 md:w-7" />
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
