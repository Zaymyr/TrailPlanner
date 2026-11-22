/**
 * KPI tile maths (pure): the change against the previous period and the sparkline path.
 */

export type DeltaDirection = "up" | "down" | "flat";
export type DeltaTone = "positive" | "negative" | "neutral";

export type KpiDelta = {
  direction: DeltaDirection;
  tone: DeltaTone;
  /** « ▲ 12,4 % », « ▼ 3 », « = » or « nouveau ». */
  label: string;
  /** Spoken form for screen readers: « en hausse de 12,4 % ». */
  description: string;
};

const percentFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/**
 * `mode: "percent"` (default) compares relatively; `mode: "absolute"` shows the raw difference (small
 * counts such as « Livrets publiés »). `higherIsBetter: false` colours a rise in red (e.g. failures).
 * A previous value of 0 gives « nouveau » (percent) since a ratio has no meaning.
 */
export const formatKpiDelta = (
  current: number,
  previous: number | null | undefined,
  options: { mode?: "percent" | "absolute"; higherIsBetter?: boolean } = {},
): KpiDelta | null => {
  if (previous === null || previous === undefined || !Number.isFinite(previous) || !Number.isFinite(current)) return null;
  const mode = options.mode ?? "percent";
  const higherIsBetter = options.higherIsBetter ?? true;
  const difference = current - previous;
  const direction: DeltaDirection = difference > 0 ? "up" : difference < 0 ? "down" : "flat";
  const tone: DeltaTone = direction === "flat" ? "neutral" : (direction === "up") === higherIsBetter ? "positive" : "negative";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "=";
  const verb = direction === "up" ? "en hausse de" : "en baisse de";

  if (direction === "flat") return { direction, tone, label: "=", description: "stable" };
  if (mode === "absolute") {
    const amount = countFormat.format(Math.abs(difference));
    return { direction, tone, label: `${arrow} ${amount}`, description: `${verb} ${amount}` };
  }
  if (previous === 0) return { direction, tone, label: "nouveau", description: "nouveau sur la période" };
  const percent = `${percentFormat.format(Math.abs((difference / Math.abs(previous)) * 100))} %`;
  return { direction, tone, label: `${arrow} ${percent}`, description: `${verb} ${percent}` };
};

/**
 * SVG path of a sparkline in a `width × height` box (y grows downwards), with 2 px of padding so the
 * stroke is not clipped. A flat series sits in the middle. Returns the line and the closed area.
 */
export const sparklinePaths = (values: number[], width = 120, height = 34): { line: string; area: string } | null => {
  const points = values.filter((value) => Number.isFinite(value));
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = 2;
  const usable = height - pad * 2;
  const round = (value: number) => Math.round(value * 10) / 10;
  const coords = points.map((value, index) => {
    const x = round((index / (points.length - 1)) * width);
    const y = round(max === min ? height / 2 : pad + (1 - (value - min) / (max - min)) * usable);
    return `${x} ${y}`;
  });
  const line = `M${coords.join(" L")}`;
  return { line, area: `${line} L${width} ${height} L0 ${height}Z` };
};
