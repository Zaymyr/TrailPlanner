"use client";

import type { ReactNode } from "react";
import { ArrowRightIcon, Clock3Icon } from "./TimelineIcons";

type StatusTone = "success" | "warning" | "neutral";

type SegmentMetric = {
  key: "carbs" | "water" | "sodium";
  label: string;
  value: string;
  targetText: string;
  targetPercent: number;
  totalPercent: number;
  statusLabel: string;
  statusTone: StatusTone;
  icon: ReactNode;
  input?: ReactNode;
};

type TimelineSegmentCardProps = {
  segmentIndex: number;
  headerLabel: string;
  fromTitle: string;
  toTitle: string;
  distanceText: string;
  segmentDistanceHelper: string;
  durationLabel: string;
  durationValue: string;
  etaText: string;
  durationHelper: string;
  timeInput?: ReactNode;
  metrics: SegmentMetric[];
};

type PointMetric = {
  key: "carbs" | "water" | "sodium";
  label: string;
  value?: string;
  helper?: string;
  icon: ReactNode;
  muted?: boolean;
};

type TimelinePointCardProps = {
  pointIndex: number;
  title: string;
  distanceText: string;
  etaText?: string;
  stockLabel: string;
  upcomingHelper?: string;
  metrics: PointMetric[];
  distanceInput?: ReactNode;
  pickupInput?: ReactNode;
  pickupHelper?: string;
  pickupLabel?: string;
  finishLabel?: string;
  removeAction?: ReactNode;
  isStart?: boolean;
  isFinish?: boolean;
};

const metricToneClasses: Record<SegmentMetric["key"], string> = {
  carbs: "border-purple-500/40 bg-purple-500/10 text-purple-50",
  water: "border-sky-500/40 bg-sky-500/10 text-sky-50",
  sodium: "border-slate-500/40 bg-slate-500/10 text-slate-50",
};

const statusToneClasses: Record<StatusTone, string> = {
  success: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  warning: "border-amber-400/30 bg-amber-500/15 text-amber-100",
  neutral: "border-slate-400/30 bg-slate-600/15 text-slate-100",
};

function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusToneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

function SegmentMetricCard({ metric }: { metric: SegmentMetric }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950/70 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
            {metric.icon}
          </span>
          <p className="text-sm font-semibold text-slate-50">{metric.label}</p>
        </div>
        <StatusPill label={metric.statusLabel} tone={metric.statusTone} />
      </div>

      <div className={`rounded-lg border px-3 py-2 ${metricToneClasses[metric.key]}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-50">{metric.value}</p>
            <p className="text-xs text-slate-200/90">
              {metric.targetText} · {metric.targetPercent.toFixed(0)}%
            </p>
          </div>
          {metric.input ? <div className="min-w-[140px] sm:text-right">{metric.input}</div> : null}
        </div>
        <p className="mt-1 text-[11px] text-slate-300/90">
          {metric.totalPercent > 0 ? `${metric.totalPercent.toFixed(0)}% du plan total` : "\u00a0"}
        </p>
      </div>
    </div>
  );
}

function PointMetricCard({ metric }: { metric: PointMetric }) {
  return (
    <div
      className={`flex flex-1 min-w-[180px] flex-col gap-2 rounded-xl border border-slate-900/80 bg-slate-950/85 px-4 py-3 shadow-inner shadow-slate-900/40 ${
        metric.muted ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-slate-100">
          {metric.icon}
        </span>
        <p className="text-[12px] font-semibold text-slate-100">{metric.label}</p>
      </div>
      <p className="text-lg font-semibold text-slate-50">{metric.value ?? "—"}</p>
      {metric.helper ? <p className="text-[11px] text-slate-400">{metric.helper}</p> : null}
    </div>
  );
}

export function TimelineSegmentCard({
  segmentIndex,
  headerLabel,
  fromTitle,
  toTitle,
  distanceText,
  segmentDistanceHelper,
  durationLabel,
  durationValue,
  etaText,
  durationHelper,
  timeInput,
  metrics,
}: TimelineSegmentCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-[0_4px_30px_rgba(15,23,42,0.35)]">
      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start md:gap-6">
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-100">
                {segmentIndex}
              </span>
              {headerLabel}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-200">{segmentDistanceHelper}</p>
              <p className="text-[11px] text-slate-500">{distanceText}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
              <p className="text-sm font-semibold text-slate-50">{fromTitle}</p>
              <ArrowRightIcon className="h-4 w-4 text-emerald-200" aria-hidden />
              <p className="text-sm font-semibold text-slate-50">{toTitle}</p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 sm:text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{durationLabel}</p>
              <div className="text-sm font-semibold text-slate-50">{timeInput ?? durationValue}</div>
              <p className="text-[11px] text-slate-400">{etaText}</p>
              <p className="text-[11px] text-slate-500">{durationHelper}</p>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-3 md:w-[360px] md:flex-none md:grid-cols-1">
          {metrics.map((metric) => (
            <SegmentMetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimelinePointCard({
  pointIndex,
  title,
  distanceText,
  etaText,
  stockLabel,
  upcomingHelper,
  metrics,
  distanceInput,
  pickupInput,
  pickupHelper,
  pickupLabel,
  finishLabel,
  removeAction,
  isStart,
  isFinish,
}: TimelinePointCardProps) {
  return (
    <div className="rounded-2xl border border-slate-900/80 bg-slate-950/85 p-4 shadow-[0_4px_30px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-100">
            {pointIndex}
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-50">{title}</p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{distanceText}</span>
              {etaText ? <span className="text-slate-500">{etaText}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {metrics.map((metric) => (
              <PointMetricCard key={metric.key} metric={metric} />
            ))}
          </div>
        </div>
        {distanceInput || removeAction ? (
          <div className="flex items-start gap-3">
            {distanceInput ? <div className="text-right text-xs text-slate-300">{distanceInput}</div> : null}
            {removeAction}
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{stockLabel}</p>
          {upcomingHelper ? <p className="text-xs text-slate-500">{upcomingHelper}</p> : null}
        </div>
        {!isStart && !isFinish ? (
          <div className="min-w-[240px] flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              {pickupLabel ?? "Gels"}
            </p>
            {pickupInput ?? <p className="text-sm text-slate-400">—</p>}
            {pickupHelper ? <p className="text-[11px] text-slate-500">{pickupHelper}</p> : null}
          </div>
        ) : null}
        {isFinish ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
            <Clock3Icon className="h-4 w-4 text-emerald-200" aria-hidden />
            <span>{finishLabel ?? "Arrivée"}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
