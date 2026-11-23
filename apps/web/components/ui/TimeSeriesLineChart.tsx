"use client";

import React, { useState } from "react";

export type TimeSeriesPoint = { date: string; values: Record<string, number | null | undefined> };
export type TimeSeriesLine = { key: string; label: string; color: string };

type Props = {
  title: string;
  description: string;
  points: TimeSeriesPoint[];
  series: TimeSeriesLine[];
  locale: string;
  emptyMessage?: string;
  ariaLabel?: string;
  /** false: no card frame nor title row (the caller's card shows them; the legend stays). */
  framed?: boolean;
  /** Hover / touch tooltip with the values of the day under the pointer (admin dashboard). */
  interactive?: boolean;
  /** Minimum width of the SVG before the chart scrolls inside its box (default 620 px). */
  minWidthClassName?: string;
};

const WIDTH = 760;
const HEIGHT = 260;
const PAD = { top: 18, right: 18, bottom: 38, left: 42 };
const TOOLTIP_WIDTH = 168;

export function TimeSeriesLineChart({ title, description, points, series, locale, emptyMessage, ariaLabel, framed = true, interactive = false, minWidthClassName = "min-w-[620px]" }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const availableSeries = series.filter((item) => points.some((point) => typeof point.values[item.key] === "number"));
  const values = points.flatMap((point) => availableSeries.flatMap((item) => {
    const value = point.values[item.key];
    return typeof value === "number" ? [value] : [];
  }));
  const maxValue = Math.max(1, ...values);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / maxValue) * plotHeight;
  const labelIndexes = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]);
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
  const formatLongDate = (date: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

  const pickIndex = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || points.length === 0) return;
    const svgX = ((event.clientX - box.left) / box.width) * WIDTH;
    const ratio = points.length <= 1 ? 0 : (svgX - PAD.left) / plotWidth;
    setHoverIndex(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  };
  const hovered = interactive && hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipX = hovered && hoverIndex !== null ? Math.min(WIDTH - PAD.right - TOOLTIP_WIDTH, Math.max(PAD.left, x(hoverIndex) - TOOLTIP_WIDTH - 10 < PAD.left ? x(hoverIndex) + 10 : x(hoverIndex) - TOOLTIP_WIDTH - 10)) : 0;

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {availableSeries.map((item) => <span key={item.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
    </div>
  );

  const body = points.length === 0 || availableSeries.length === 0 ? (
    <p className={framed ? "mt-8 text-sm text-muted-foreground" : "py-8 text-sm text-muted-foreground"}>{emptyMessage ?? (locale.startsWith("fr") ? "Aucune série disponible sur cette période." : "No series available for this period.")}</p>
  ) : (
    <div className={framed ? "mt-4 overflow-x-auto" : "overflow-x-auto"}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={`h-auto w-full ${minWidthClassName}`}
        role="img"
        aria-label={ariaLabel ?? `${title}. ${description}`}
        onPointerMove={interactive ? pickIndex : undefined}
        onPointerDown={interactive ? pickIndex : undefined}
        onPointerLeave={interactive ? () => setHoverIndex(null) : undefined}
      >
        {[0, 0.5, 1].map((ratio) => {
          const gridY = PAD.top + plotHeight * ratio;
          return <g key={ratio}><line x1={PAD.left} x2={WIDTH - PAD.right} y1={gridY} y2={gridY} stroke="currentColor" className="text-border" strokeDasharray="4 5" /><text x={PAD.left - 9} y={gridY + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">{Math.round(maxValue * (1 - ratio))}</text></g>;
        })}
        {points.map((point, index) => labelIndexes.has(index) ? <text key={point.date} x={x(index)} y={HEIGHT - 10} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">{formatDate(point.date)}</text> : null)}
        {availableSeries.map((item) => {
          const numericPoints = points.flatMap((point, index) => {
            const value = point.values[item.key];
            return typeof value === "number" ? [{ point, index, value }] : [];
          });
          const path = numericPoints.map(({ index, value }, pathIndex) => `${pathIndex === 0 ? "M" : "L"} ${x(index)} ${y(value)}`).join(" ");
          return <g key={item.key}><path d={path} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{numericPoints.map(({ point, index, value }) => <circle key={`${item.key}-${point.date}`} cx={x(index)} cy={y(value)} r={hoverIndex === index && interactive ? 5 : 3.5} fill={item.color}><title>{`${formatDate(point.date)} · ${item.label}: ${value}`}</title></circle>)}</g>;
        })}
        {hovered && hoverIndex !== null ? (
          <g pointerEvents="none" aria-hidden="true">
            <line x1={x(hoverIndex)} x2={x(hoverIndex)} y1={PAD.top} y2={PAD.top + plotHeight} stroke="currentColor" strokeDasharray="3 3" className="text-foreground" opacity={0.35} />
            <g transform={`translate(${tooltipX} ${PAD.top + 4})`}>
              <rect width={TOOLTIP_WIDTH} height={26 + availableSeries.length * 17} rx={8} fill="#1c2113" />
              <text x={10} y={18} fill="#c8d0bb" fontSize={12}>{formatLongDate(hovered.date)}</text>
              {availableSeries.map((item, index) => (
                <g key={item.key} transform={`translate(10 ${36 + index * 17})`}>
                  <circle cx={4} cy={-4} r={4} fill={item.color} />
                  <text x={14} y={0} fill="#fff" fontSize={12} fontFamily="var(--font-admin-mono, ui-monospace), monospace">{`${hovered.values[item.key] ?? "–"} ${item.label.toLowerCase()}`}</text>
                </g>
              ))}
            </g>
          </g>
        ) : null}
      </svg>
    </div>
  );

  if (!framed) {
    return (
      <div className="flex flex-col gap-3">
        {legend}
        {body}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h3 className="font-semibold text-foreground">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
        {legend}
      </div>
      {body}
    </div>
  );
}
