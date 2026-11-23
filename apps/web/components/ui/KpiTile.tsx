import { cn } from "../utils";
import { formatKpiDelta, sparklinePaths } from "./kpi-delta";

type KpiTileProps = {
  label: string;
  /** Already formatted value (« 1 284 », « 1 127 € »). */
  value: string;
  /** Raw values for the change against the previous period. */
  current?: number;
  previous?: number | null;
  /** Formatted previous value shown after the change (« · 1 142 »). */
  previousLabel?: string;
  deltaMode?: "percent" | "absolute";
  higherIsBetter?: boolean;
  /** Series of the period, oldest first, for the sparkline. */
  series?: number[];
  unit?: string;
  /** One short line under the value (« 3 lignes · 1 en retard »). */
  hint?: string;
  className?: string;
};

const TONE_TEXT = { positive: "text-emerald-700 dark:text-emerald-300", negative: "text-red-700 dark:text-red-300", neutral: "text-muted-foreground" } as const;
const TONE_STROKE = { positive: "#2d5016", negative: "#e05252", neutral: "#8a917e" } as const;

/** KPI of the admin dashboard: label, value in mono figures, coloured change and a sparkline. */
export function KpiTile({ label, value, current, previous, previousLabel, deltaMode, higherIsBetter, series, unit, hint, className }: KpiTileProps) {
  const delta = typeof current === "number" ? formatKpiDelta(current, previous, { mode: deltaMode, higherIsBetter }) : null;
  const paths = series ? sparklinePaths(series) : null;
  const stroke = TONE_STROKE[delta?.tone ?? "positive"];
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-[14px] border border-border bg-card px-4 pb-2.5 pt-3.5 shadow-sm", className)}>
      <p className="flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-muted-foreground">
        <span>{label}</span>
        {unit ? <span className="font-mono">{unit}</span> : null}
      </p>
      <p className="font-mono text-[26px] font-bold leading-tight tracking-tight text-foreground tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {delta ? (
        <p className={cn("text-xs font-semibold", TONE_TEXT[delta.tone])}>
          <span aria-hidden="true">{delta.label}</span>
          <span className="sr-only">{delta.description}</span>
          {previousLabel ? <span className="font-medium text-muted-foreground"> · {previousLabel}</span> : null}
        </p>
      ) : null}
      {paths ? (
        <svg aria-hidden="true" viewBox="0 0 120 34" preserveAspectRatio="none" className="h-[34px] w-full">
          <path d={paths.area} fill={stroke} opacity={0.08} />
          <path d={paths.line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
    </div>
  );
}
