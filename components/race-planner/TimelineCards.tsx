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
  etaText: string;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-6">
        <div className="flex-1 space-y-3">
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

          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="min-w-[120px] space-y-0.5">
                  <p className="text-sm font-semibold text-slate-50">{fromTitle}</p>
                </div>
                <div className="relative flex flex-1 items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" aria-hidden />
                  <div className="relative flex-1">
                    <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-emerald-400/40 via-emerald-400 to-emerald-300/70" />
                    <div className="relative flex h-6 items-center justify-end">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15">
                        <ArrowRightIcon className="h-3.5 w-3.5 text-emerald-200" aria-hidden />
                      </span>
                    </div>
                  </div>
                  <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" aria-hidden />
                </div>
                <div className="min-w-[120px] space-y-0.5 text-right">
                  <p className="text-sm font-semibold text-slate-50">{toTitle}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <p>{segmentDistanceHelper}</p>
                <p>{distanceText}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{durationLabel}</p>
                {timeInput ?? <p className="text-sm font-semibold text-slate-50">{durationValue}</p>}
              </div>
              <div className="text-right sm:text-left">
                <p className="text-[11px] text-slate-400">{etaText}</p>
                <p className="text-[11px] text-slate-500">{durationHelper}</p>
              </div>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-[0_4px_30px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-100">
            {pointIndex}
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-50">{title}</p>
            <p className="text-xs text-slate-300">{distanceText}</p>
            <p className="text-xs text-slate-500">{etaText}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
          {removeAction}
          {distanceInput}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-5">
        <div className="md:col-span-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{stockLabel}</p>
          {upcomingHelper ? <p className="text-xs text-slate-500">{upcomingHelper}</p> : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.key}
                className={`rounded-lg border border-slate-800 bg-slate-900/70 p-3 ${metric.muted ? "opacity-60" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-200">
                    {metric.icon}
                  </span>
                  <p className="text-sm font-semibold text-slate-50">{metric.label}</p>
                </div>
                <p className="mt-1 text-base font-semibold text-slate-50">{metric.value ?? "—"}</p>
                {metric.helper ? <p className="text-[11px] text-slate-400">{metric.helper}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 md:col-span-2">
          {!isStart && !isFinish ? (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{pickupLabel ?? "Gels"}</p>
              {pickupInput ?? <p className="text-sm text-slate-400">—</p>}
              {pickupHelper ? <p className="text-[11px] text-slate-500">{pickupHelper}</p> : null}
            </div>
          ) : null}
          {isFinish ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <Clock3Icon className="h-4 w-4 text-emerald-200" aria-hidden />
                <span>{finishLabel ?? "Arrivée"}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
