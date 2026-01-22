"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { UseFormRegister, UseFormSetValue } from "react-hook-form";

import type { CoachCommentsTranslations, RacePlannerTranslations } from "../../locales/types";
import type { FormValues, Segment, SegmentPlan, StationSupply } from "../../app/(coach)/race-planner/types";
import type { CoachComment } from "../../lib/coach-comments";
import type { FuelProduct } from "../../lib/product-types";
import type { StoredProductPreference } from "../../lib/product-preferences";
import { fuelTypeValues, type FuelType } from "../../lib/fuel-types";
import { useCoachComments } from "../../app/hooks/useCoachComments";
import { useI18n } from "../../app/i18n-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionHeader } from "../ui/SectionHeader";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AidStationBadge } from "./AidStationBadge";
import { FuelTypeBadge, getFuelTypeLabel } from "../products/FuelTypeBadge";
import { CoachCommentsBlock, CommentsPanel } from "./CoachCommentsBlock";
import {
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DropletIcon,
  GaugeIcon,
  SparklesIcon,
} from "./TimelineIcons";

const statusToneStyles = {
  success: "border-emerald-400/40 bg-emerald-500/20 text-emerald-50",
  warning: "border-amber-400/40 bg-amber-500/15 text-amber-50",
  danger: "border-rose-400/40 bg-rose-500/20 text-rose-50",
  neutral: "border-slate-400/40 bg-slate-600/20 text-slate-50",
} as const;

type StatusTone = keyof typeof statusToneStyles;

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildGaugeRanges = (targetValue: number, maxValue: number) => {
  const safeTarget = Math.max(targetValue, 0);
  const safeMax = Math.max(maxValue, safeTarget);
  const lowerWarning = safeTarget * 0.6;
  const upperWarning = safeMax;
  const fallbackTolerance = safeTarget * 0.1;
  let tolerance = Math.min(safeTarget - lowerWarning, upperWarning - safeTarget);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    tolerance = fallbackTolerance;
  }
  const gaugeMax = safeMax * 1.3;
  let greenStart = safeTarget - tolerance;
  let greenEnd = safeTarget + tolerance;
  if (greenStart < 0) {
    greenEnd = Math.min(gaugeMax, greenEnd - greenStart);
    greenStart = 0;
  }
  if (greenEnd > gaugeMax) {
    greenStart = Math.max(0, greenStart - (greenEnd - gaugeMax));
    greenEnd = gaugeMax;
  }
  const upperDanger = upperWarning * 1.1;
  return {
    gaugeMax,
    lowerWarning,
    upperWarning,
    upperDanger,
    greenStart,
    greenEnd,
  };
};

type RaceTotals = {
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
  durationMinutes: number;
};

type ActionPlanProps = {
  copy: RacePlannerTranslations;
  segments: Segment[];
  raceTotals: RaceTotals | null;
  sectionId: string;
  onPrint: () => void;
  onAutomaticFill: () => void;
  onAddAidStation: (station: { name: string; distanceKm: number }) => void;
  onRemoveAidStation: (index: number) => void;
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  formatDistanceWithUnit: (value: number) => string;
  formatMinutes: (totalMinutes: number) => string;
  formatFuelAmount: (value: number) => string;
  formatWaterAmount: (value: number) => string;
  formatSodiumAmount: (value: number) => string;
  fuelProducts: FuelProduct[];
  favoriteProducts: StoredProductPreference[];
  onFavoriteToggle: (product: FuelProduct) => { updated: boolean; reason?: "limit" };
  startSupplies: StationSupply[];
  onStartSupplyDrop: (productId: string, quantity?: number) => void;
  onStartSupplyRemove: (productId: string) => void;
  onSupplyDrop: (aidStationIndex: number, productId: string, quantity?: number) => void;
  onSupplyRemove: (aidStationIndex: number, productId: string) => void;
  allowAutoFill: boolean;
  allowExport: boolean;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  onUpgrade: (reason: "autoFill" | "print") => void;
  upgradeStatus: "idle" | "opening";
  coachCommentsCopy: CoachCommentsTranslations;
  coachCommentsContext?: {
    accessToken?: string;
    planId?: string;
    coacheeId?: string;
    canEdit?: boolean;
  };
};

const parseOptionalNumber = (value: string | number) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatPaceValue = (minutesPerKm: number) => {
  if (!Number.isFinite(minutesPerKm) || minutesPerKm <= 0) return "--";
  const totalSeconds = Math.round(minutesPerKm * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}'${seconds.toString().padStart(2, "0")}"`;
};

type FinishSummaryMetric = {
  key: string;
  label: string;
  value: string;
  helper?: string | null;
};

type FinishSummaryGroup = {
  title: string;
  icon: ReactNode;
  primary: FinishSummaryMetric;
  secondary?: FinishSummaryMetric[];
};

type FinishSummaryCardProps = {
  pointIndex: number;
  title: string;
  distanceText: string;
  performanceGroup: FinishSummaryGroup;
  energyGroup: FinishSummaryGroup;
  hydrationGroup: FinishSummaryGroup;
  details: FinishSummaryMetric[];
  detailsLabel: string;
  detailsId: string;
  isExpanded: boolean;
  onToggleDetails: () => void;
};

function SummaryGroup({ title, icon, primary, secondary }: FinishSummaryGroup) {
  return (
    <div className="rounded-2xl bg-muted/40 p-3 shadow-sm dark:bg-slate-900/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground shadow-sm dark:bg-slate-950/70">
          {icon}
        </span>
        <span>{title}</span>
      </div>
      <div className="mt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
          {primary.label}
        </p>
        <p className="text-lg font-semibold text-foreground dark:text-slate-50">{primary.value}</p>
        {primary.helper ? (
          <p className="text-[11px] text-muted-foreground dark:text-slate-400">{primary.helper}</p>
        ) : null}
      </div>
      {secondary?.length ? (
        <div className="mt-2 space-y-1 text-xs text-foreground dark:text-slate-50">
          {secondary.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground dark:text-slate-400">{item.label}</span>
              <span className="font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FinishSummaryCard({
  pointIndex,
  title,
  distanceText,
  performanceGroup,
  energyGroup,
  hydrationGroup,
  details,
  detailsLabel,
  detailsId,
  isExpanded,
  onToggleDetails,
}: FinishSummaryCardProps) {
  return (
    <div className="rounded-2xl border border-border-strong bg-card p-4 shadow-md dark:bg-slate-950/85 dark:shadow-[0_4px_30px_rgba(15,23,42,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[220px] items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-100">
            {pointIndex}
          </span>
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground dark:text-slate-50">{title}</div>
            <div className="text-xs font-normal text-muted-foreground dark:text-slate-300">{distanceText}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SummaryGroup {...performanceGroup} />
        <SummaryGroup {...energyGroup} />
        <SummaryGroup {...hydrationGroup} />
      </div>

      <div className="mt-4 border-t border-border/70 pt-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800/60"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={onToggleDetails}
        >
          {detailsLabel}
          {isExpanded ? <ChevronUpIcon className="h-4 w-4" aria-hidden /> : <ChevronDownIcon className="h-4 w-4" aria-hidden />}
        </button>

        {isExpanded ? (
          <div id={detailsId} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {details.map((detail) => (
              <div key={detail.key} className="flex items-center justify-between gap-2 text-xs text-foreground dark:text-slate-50">
                <span className="text-muted-foreground dark:text-slate-400">{detail.label}</span>
                <span className="font-semibold text-foreground dark:text-slate-50">{detail.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const getSegmentFieldName = (segment: Segment, field: keyof SegmentPlan) => {
  if (segment.isFinish) return `finishPlan.${field}` as const;
  if (typeof segment.aidStationIndex === "number") {
    return `aidStations.${segment.aidStationIndex}.${field}` as const;
  }
  return null;
};

type RenderItem =
  | {
      id: string;
      title: string;
      distanceKm: number;
      etaMinutes: number;
      isStart?: boolean;
      isFinish?: boolean;
      aidStationIndex?: number;
      pickupGels?: number;
      checkpointSegment?: Segment;
      upcomingSegment?: Segment;
    };

const buildRenderItems = (segments: Segment[]): RenderItem[] => {
  if (segments.length === 0) return [];

  const items: RenderItem[] = [];
  const startSegment = segments[0];

  items.push({
    id: `point-${startSegment.from}-start`,
    title: startSegment.from,
    distanceKm: startSegment.startDistanceKm,
    etaMinutes: 0,
    isStart: true,
    upcomingSegment: startSegment,
  });

  segments.forEach((segment, index) => {
    items.push({
      id: `point-${segment.checkpoint}-${segment.distanceKm}`,
      title: segment.checkpoint,
      distanceKm: segment.distanceKm,
      etaMinutes: segment.etaMinutes,
      isFinish: segment.isFinish,
      aidStationIndex: segment.aidStationIndex,
      pickupGels: segment.pickupGels,
      checkpointSegment: segment,
      upcomingSegment: segments[index + 1],
    });
  });

  return items;
};

const PremiumSparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <SparklesIcon
    className="h-3.5 w-3.5 text-muted-foreground dark:text-slate-100/60"
    strokeWidth={2}
    {...props}
  />
);

type SegmentCardVariant = "default" | "compact" | "compactChip";

type SegmentCardProps = {
  distanceText: string;
  timeText: string;
  elevationGainText: string;
  elevationLossText: string;
  paceControl?: ReactNode;
  variant?: SegmentCardVariant;
};

function SegmentCard({
  distanceText,
  timeText,
  elevationGainText,
  elevationLossText,
  paceControl,
  variant = "default",
}: SegmentCardProps) {
  const isCompact = variant === "compact";
  const isCompactChip = variant === "compactChip";
  return (
    <div
      className={
        isCompactChip
          ? "flex w-[170px] flex-col gap-1.5 rounded-xl border border-border bg-card px-2 py-1.5 text-foreground shadow-sm dark:bg-slate-950/90 dark:text-slate-200"
          : isCompact
            ? "flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2 text-foreground shadow-sm dark:bg-slate-950/50 dark:text-slate-200"
            : "flex flex-col gap-3 rounded-2xl border border-border-strong bg-card px-4 py-3 text-foreground shadow-sm dark:bg-slate-950/80 dark:text-slate-100"
      }
    >
      <div
        className={
          isCompactChip
            ? "flex items-center justify-between text-xs font-semibold"
            : isCompact
              ? "flex items-center justify-between text-xs font-semibold"
              : "flex items-center justify-between text-sm font-semibold"
        }
      >
        <span className="tabular-nums">{distanceText}</span>
        <span className="tabular-nums text-red-600 dark:text-red-400">{elevationGainText}</span>
      </div>
      <div
        className={
          isCompactChip
            ? "flex items-center justify-between text-[11px] font-semibold"
            : isCompact
              ? "flex items-center justify-between text-[11px] font-semibold"
              : "flex items-center justify-between text-xs font-semibold"
        }
      >
        <span className="tabular-nums text-muted-foreground dark:text-slate-400">{timeText}</span>
        <span className="text-blue-600 dark:text-blue-400">{elevationLossText}</span>
      </div>
      {paceControl ? <div className="flex items-center justify-center">{paceControl}</div> : null}
    </div>
  );
}

type NutritionCardVariant = "default" | "compact";

type NutritionMetric = {
  key: "carbs" | "water" | "sodium";
  label: string;
  name: string;
  value: string;
  plannedValue: number;
  targetValue: number;
  helper: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  icon: ReactNode;
  format: (value: number) => string;
};

type NutritionCardProps = {
  metric: NutritionMetric;
  variant?: NutritionCardVariant;
  waterCapacityMl?: number | null;
  targetLabel: string;
};

function NutritionCard({ metric, variant = "default", waterCapacityMl, targetLabel }: NutritionCardProps) {
  const isCompact = variant === "compact";
  const compactValue = metric.value.split(" de ")[0].split(" d'")[0];
  const compactTarget = metric.format(metric.targetValue).split(" de ")[0].split(" d'")[0];
  const targetValue = Math.max(metric.targetValue, 0);
  const maxValueCandidate =
    metric.key === "water" && typeof waterCapacityMl === "number" && waterCapacityMl > 0
      ? waterCapacityMl
      : targetValue;
  const maxValue = Math.max(maxValueCandidate, targetValue * 1.2 || 1);
  const ranges = buildGaugeRanges(targetValue, maxValue);
  const scaleMax = ranges.gaugeMax;
  const cursorPercent = clampNumber((metric.plannedValue / scaleMax) * 100, 0, 100);
  const targetPercent = clampNumber((targetValue / scaleMax) * 100, 0, 100);
  const lowerWarningPercent = clampNumber((ranges.lowerWarning / scaleMax) * 100, 0, 100);
  const greenStartPercent = clampNumber((ranges.greenStart / scaleMax) * 100, 0, 100);
  const greenEndPercent = clampNumber((ranges.greenEnd / scaleMax) * 100, 0, 100);
  const upperDangerPercent = clampNumber((ranges.upperDanger / scaleMax) * 100, 0, 100);
  const valueToneClass =
    metric.statusTone === "success"
      ? "text-emerald-600 dark:text-emerald-300"
      : metric.statusTone === "warning"
        ? "text-amber-600 dark:text-amber-300"
        : metric.statusTone === "danger"
          ? "text-rose-600 dark:text-rose-300"
          : "text-foreground dark:text-slate-50";
  const valueMarkerToneClass =
    metric.statusTone === "success"
      ? "border-t-emerald-500 dark:border-t-emerald-300"
      : metric.statusTone === "warning"
        ? "border-t-amber-500 dark:border-t-amber-300"
        : metric.statusTone === "danger"
          ? "border-t-rose-500 dark:border-t-rose-300"
          : "border-t-slate-500 dark:border-t-slate-300";

  return (
    <div
      className={`rounded-xl border bg-card shadow-sm dark:bg-slate-950/70 ${
        isCompact ? "p-2" : "p-4"
      } ${
        metric.statusTone === "success"
          ? "border-emerald-500/40"
          : metric.statusTone === "warning"
            ? "border-amber-500/40"
            : metric.statusTone === "danger"
              ? "border-rose-500/40"
              : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center rounded-full bg-white ${
              isCompact ? "h-7 w-7" : "h-9 w-9"
            }`}
          >
            {metric.icon}
          </span>
          <div className="flex flex-col">
            {isCompact ? (
              <p className="text-[11px] font-semibold text-foreground dark:text-slate-200">{metric.name}</p>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-slate-400">
                  {metric.label}
                </p>
                <p className="text-sm font-semibold text-foreground dark:text-slate-50">{metric.name}</p>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={isCompact ? "mt-1.5 flex flex-col gap-1" : "mt-3 flex flex-col gap-3"}>
        <p className={`${isCompact ? "text-xl" : "text-3xl"} font-extrabold leading-tight ${valueToneClass}`}>
          {isCompact ? compactValue : metric.value}
        </p>
        <div className={isCompact ? "space-y-1" : "space-y-2"}>
          <div className="relative w-full">
            <div
              className={`relative w-full overflow-hidden rounded-full border border-border bg-background dark:bg-slate-900 ${
                isCompact ? "h-2" : "h-4"
              }`}
            >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to right,
                      rgba(248,113,113,0.75) 0%,
                      rgba(248,113,113,0.75) ${lowerWarningPercent}%,
                      rgba(251,146,60,0.75) ${lowerWarningPercent}%,
                      rgba(251,146,60,0.75) ${greenStartPercent}%,
                      rgba(16,185,129,0.8) ${greenStartPercent}%,
                      rgba(16,185,129,0.8) ${greenEndPercent}%,
                      rgba(251,146,60,0.75) ${greenEndPercent}%,
                      rgba(251,146,60,0.75) ${upperDangerPercent}%,
                      rgba(248,113,113,0.75) ${upperDangerPercent}%,
                      rgba(248,113,113,0.75) 100%)`,
                  }}
                  aria-hidden
                />
            </div>
            <span
              className={`absolute left-0 top-full mt-0.5 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-0 border-x-transparent border-b-[6px] border-b-slate-500/70 dark:border-b-slate-200/70 ${
                isCompact ? "border-x-[4px] border-b-[5px]" : ""
              }`}
              style={{ left: `${targetPercent}%` }}
              aria-label={targetLabel}
            />
            <span
              className={`absolute left-0 bottom-full mb-0.5 h-0 w-0 -translate-x-1/2 border-x-[5px] border-b-0 border-x-transparent border-t-[6px] ${
                isCompact ? "border-x-[4px] border-t-[5px]" : ""
              } ${valueMarkerToneClass}`}
              style={{ left: `${cursorPercent}%` }}
              aria-label={metric.name}
            />
          </div>
          {isCompact ? (
            <div className="relative h-2.5">
              <span
                className="absolute top-0 -translate-x-1/2 text-[9px] font-semibold text-muted-foreground dark:text-slate-400"
                style={{ left: `${targetPercent}%` }}
              >
                {compactTarget}
              </span>
            </div>
          ) : null}
          {isCompact ? (
            metric.helper ? <p className="text-[9px] font-semibold text-amber-200/80">{metric.helper}</p> : null
          ) : (
            <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-slate-200">
              <span className="font-semibold">
                {targetLabel}: {metric.format(targetValue)}
              </span>
              {metric.helper ? <span className="text-amber-100">{metric.helper}</span> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type AidStationHeaderRowProps = {
  pointIndex: number;
  badge?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  headerMiddle?: ReactNode;
  headerActions?: ReactNode;
  finishLabel?: string;
  isFinish?: boolean;
  onTitleClick?: () => void;
};

function AidStationHeaderRow({
  pointIndex,
  badge,
  title,
  meta,
  headerMiddle,
  headerActions,
  finishLabel,
  isFinish,
  onTitleClick,
}: AidStationHeaderRowProps) {
  return (
    <div className="relative z-20 rounded-2xl border-2 border-blue-500/70 bg-card px-5 py-4 shadow-md dark:border-blue-400/70 dark:bg-slate-950/95 dark:shadow-[0_10px_36px_rgba(15,23,42,0.4)]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr_auto] lg:items-center">
        <div
          className={`flex min-w-[220px] items-start gap-3 ${onTitleClick ? "cursor-pointer" : ""}`}
          onClick={onTitleClick}
          role={onTitleClick ? "button" : undefined}
          tabIndex={onTitleClick ? 0 : undefined}
          onKeyDown={
            onTitleClick
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onTitleClick();
                  }
                }
              : undefined
          }
        >
          {badge ?? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-sm font-semibold text-emerald-900 dark:border-transparent dark:bg-emerald-500/25 dark:text-emerald-100">
              {pointIndex}
            </span>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold text-foreground dark:text-slate-50">
              <span>{title}</span>
            </div>
            {meta ? <div className="text-xs font-normal text-muted-foreground dark:text-slate-300">{meta}</div> : null}
          </div>
        </div>
        {headerMiddle ? (
          <div className="flex w-full min-w-[240px] flex-1 justify-center">{headerMiddle}</div>
        ) : null}
        {headerActions ? <div className="flex items-center justify-end gap-3">{headerActions}</div> : null}
      </div>
      {isFinish ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground dark:bg-slate-900/60 dark:text-slate-300">
          <span>{finishLabel ?? "Arrivée"}</span>
        </div>
      ) : null}
    </div>
  );
}

type SectionRowProps = {
  segment: ReactNode;
  nutritionCards: ReactNode;
  showConnector?: boolean;
};

function SectionRow({ segment, nutritionCards, showConnector = true }: SectionRowProps) {
  return (
    <div className="relative flex justify-center">
      <div className="relative z-10 -mt-3 w-full rounded-2xl border border-dashed border-blue-500/60 bg-card p-4 shadow-sm dark:border-blue-400/60 dark:bg-slate-950/55 lg:mx-auto lg:max-w-[1120px]">
        {showConnector ? (
          <div className="pointer-events-none absolute bottom-3 left-[116px] top-3 z-0 hidden flex-col items-center md:flex">
            <div className="h-full w-[2px] bg-emerald-500/70" />
            <div className="-mt-1 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-emerald-500/80" />
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[minmax(200px,240px)_1fr] md:items-center md:gap-4 lg:grid-cols-[240px_1fr] lg:gap-5">
          <div className="relative z-10 w-full max-w-[240px] self-center">{segment}</div>
          <div className="w-full">
            <div className="grid w-full gap-4 md:grid-cols-3">{nutritionCards}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

type EmbarkedSummaryItem = {
  key: string;
  label: string;
  value: string;
  dotClassName: string;
};

type EmbarkedSummaryBoxProps = {
  items: EmbarkedSummaryItem[];
};

function EmbarkedSummaryBox({ items }: EmbarkedSummaryBoxProps) {
  return (
    <div className="w-full rounded-xl border border-dashed border-emerald-400/70 bg-emerald-500/5 px-4 py-2.5 md:max-w-[300px]">
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-2 text-xs text-foreground dark:text-slate-50">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${item.dotClassName}`} />
              <span className="font-medium">{item.label}</span>
            </span>
            <span className="font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type AidStationCollapsedRowProps = {
  pointIndex: number;
  badge?: ReactNode;
  title: ReactNode;
  leftIcon?: ReactNode;
  metaLine: string;
  pauseLine: string;
  segmentCard?: ReactNode;
  embarkedItems: EmbarkedSummaryItem[];
  actions?: ReactNode;
};

function AidStationCollapsedRow({
  pointIndex,
  badge,
  title,
  leftIcon,
  metaLine,
  pauseLine,
  segmentCard,
  embarkedItems,
  actions,
}: AidStationCollapsedRowProps) {
  return (
    <div className="rounded-2xl border-2 border-blue-500/70 bg-card px-4 py-3 shadow-md dark:border-blue-400/70 dark:bg-slate-950/90 dark:shadow-[0_6px_26px_rgba(15,23,42,0.4)]">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <div className="relative flex shrink-0 flex-col items-center gap-2">
          {badge ? (
            badge
          ) : (
            <>
              <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/25 text-[11px] font-semibold text-emerald-100">
                {pointIndex}
              </span>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-background text-foreground dark:bg-slate-900/70 dark:text-slate-50">
                {leftIcon}
              </div>
            </>
          )}
          <div className="hidden flex-col items-center md:flex">
            <span className="h-8 w-[2px] bg-emerald-400/80" />
            <span className="h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-emerald-400/80" />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1 md:order-1">
          <div className="truncate text-sm font-semibold text-foreground dark:text-slate-50">{title}</div>
          <div className="truncate text-xs text-muted-foreground dark:text-slate-300">{metaLine}</div>
          <div className="truncate text-[11px] text-muted-foreground dark:text-slate-400">{pauseLine}</div>
        </div>
        <div className="order-3 flex w-full justify-start md:order-2 md:w-[190px] md:justify-center lg:order-2">
          {segmentCard}
        </div>
        <div className="order-4 w-full md:order-3 md:w-auto lg:order-3">
          <EmbarkedSummaryBox items={embarkedItems} />
        </div>
        {actions ? (
          <div className="order-2 ml-auto flex items-center justify-end gap-3 md:order-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ActionPlan({
  copy,
  segments,
  raceTotals,
  sectionId,
  onPrint,
  onAutomaticFill,
  onAddAidStation,
  onRemoveAidStation,
  register,
  setValue,
  formatDistanceWithUnit,
  formatMinutes,
  formatFuelAmount,
  formatWaterAmount,
  formatSodiumAmount,
  fuelProducts,
  favoriteProducts,
  onFavoriteToggle,
  startSupplies,
  onStartSupplyDrop,
  onStartSupplyRemove,
  onSupplyDrop,
  onSupplyRemove,
  allowAutoFill,
  allowExport,
  premiumCopy,
  onUpgrade,
  upgradeStatus,
  coachCommentsCopy,
  coachCommentsContext,
}: ActionPlanProps) {
  const { locale } = useI18n();
  const [collapsedAidStations, setCollapsedAidStations] = useState<Record<string, boolean>>({});
  const [isFinishDetailsOpen, setIsFinishDetailsOpen] = useState(false);
  const finishDetailsId = useId();
  const [editorState, setEditorState] = useState<
    | null
    | {
        mode: "edit";
        index: number;
        name: string;
        distance: string;
        pauseMinutes: string;
      }
    | {
        mode: "create";
        name: string;
        distance: string;
        pauseMinutes: string;
      }
  >(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [supplyPicker, setSupplyPicker] = useState<{ type: "start" | "aid"; index?: number } | null>(null);
  const [pickerFavorites, setPickerFavorites] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFuelType, setPickerFuelType] = useState<FuelType | "all">("all");
  const [pickerSort, setPickerSort] = useState<{
    key: "name" | "type" | "carbs" | "sodium" | "calories" | "favorite";
    dir: "asc" | "desc";
  }>({
    key: "favorite",
    dir: "desc",
  });
  const timelineCopy = copy.sections.timeline;
  const aidStationsCopy = copy.sections.aidStations;
  const openCreateEditor = () =>
    setEditorState({
      mode: "create",
      name: copy.defaults.aidStationName,
      distance: "0",
      pauseMinutes: "",
    });
  const updateEditorField = useCallback((field: "name" | "distance" | "pauseMinutes", value: string) => {
    setEditorState((current) => (current ? { ...current, [field]: value } : current));
    setEditorError(null);
  }, []);
  const productBySlug = useMemo(() => Object.fromEntries(fuelProducts.map((product) => [product.slug, product])), [fuelProducts]);
  const pickerFavoriteSet = useMemo(() => new Set(pickerFavorites), [pickerFavorites]);
  useEffect(() => {
    setPickerFavorites(favoriteProducts.map((product) => product.slug));
  }, [favoriteProducts]);
  const filteredPickerProducts = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase();
    return fuelProducts.filter((product) => {
      const matchesSearch =
        !term || product.name.toLowerCase().includes(term) || product.slug.toLowerCase().includes(term);
      const matchesType = pickerFuelType === "all" || product.fuelType === pickerFuelType;
      return matchesSearch && matchesType;
    });
  }, [fuelProducts, pickerFuelType, pickerSearch]);
  const renderItems = buildRenderItems(segments);
  const {
    data: coachCommentsData,
    createComment,
    updateComment,
    deleteComment,
    isCreating: isCoachCommentCreating,
    isUpdating: isCoachCommentUpdating,
    isDeleting: isCoachCommentDeleting,
    createError: coachCommentCreateError,
    updateError: coachCommentUpdateError,
    deleteError: coachCommentDeleteError,
  } = useCoachComments({
    accessToken: coachCommentsContext?.accessToken,
    planId: coachCommentsContext?.planId,
  });
  const coachComments = coachCommentsData ?? [];
  const commentsByContext = useMemo(() => {
    const map = new Map<string, CoachComment[]>();
    coachComments.forEach((comment) => {
      const key = comment.targetType === "plan" ? "plan" : comment.targetId;
      if (!key) return;
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, comment]);
    });
    return map;
  }, [coachComments]);
  const planComments = commentsByContext.get("plan") ?? [];
  const commentContextOptions = useMemo(() => {
    const baseOptions = [
      {
        targetType: "plan" as const,
        targetId: "plan",
        label: coachCommentsCopy.contextOptions.plan,
      },
      {
        targetType: "section" as const,
        targetId: "start",
        label: coachCommentsCopy.contextOptions.start,
      },
      {
        targetType: "section" as const,
        targetId: "finish",
        label: coachCommentsCopy.contextOptions.finish,
      },
    ];
    const aidStationOptions = new Map<number, { targetType: "aid-station"; targetId: string; label: string }>();
    renderItems.forEach((item) => {
      if (typeof item.aidStationIndex !== "number" || item.isFinish) return;
      const index = item.aidStationIndex;
      if (aidStationOptions.has(index)) return;
      const labelBase = coachCommentsCopy.contextOptions.aidStation.replace("{index}", String(index + 1));
      const label = item.title ? `${labelBase} · ${item.title}` : labelBase;
      aidStationOptions.set(index, {
        targetType: "aid-station",
        targetId: `aid-${index}`,
        label,
      });
    });
    return [...baseOptions, ...Array.from(aidStationOptions.values())];
  }, [
    coachCommentsCopy.contextOptions.aidStation,
    coachCommentsCopy.contextOptions.finish,
    coachCommentsCopy.contextOptions.plan,
    coachCommentsCopy.contextOptions.start,
    renderItems,
  ]);
  const canEditCoachComments = Boolean(
    coachCommentsContext?.canEdit &&
      coachCommentsContext?.accessToken &&
      coachCommentsContext?.planId &&
      coachCommentsContext?.coacheeId
  );
  const handleCreateCoachComment = useCallback(
    async (payload: { targetType: CoachComment["targetType"]; targetId: string; body: string }) => {
      if (!coachCommentsContext?.coacheeId || !coachCommentsContext?.planId) return;
      await createComment({
        coacheeId: coachCommentsContext.coacheeId,
        planId: coachCommentsContext.planId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        body: payload.body,
      });
    },
    [coachCommentsContext?.coacheeId, coachCommentsContext?.planId, createComment]
  );
  const handleUpdateCoachComment = useCallback(
    async (payload: { id: string; targetType: CoachComment["targetType"]; targetId: string; body: string }) => {
      if (!coachCommentsContext?.coacheeId || !coachCommentsContext?.planId) return;
      await updateComment({
        id: payload.id,
        coacheeId: coachCommentsContext.coacheeId,
        planId: coachCommentsContext.planId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        body: payload.body,
      });
    },
    [coachCommentsContext?.coacheeId, coachCommentsContext?.planId, updateComment]
  );
  const handleDeleteCoachComment = useCallback(
    async (commentId: string) => {
      if (!coachCommentsContext?.coacheeId || !coachCommentsContext?.planId) return;
      await deleteComment({
        id: commentId,
        coacheeId: coachCommentsContext.coacheeId,
        planId: coachCommentsContext.planId,
      });
    },
    [coachCommentsContext?.coacheeId, coachCommentsContext?.planId, deleteComment]
  );
  const collapsibleKeys = useMemo(() => {
    const keys = new Set<string>();
    renderItems.forEach((item) => {
      if (!item.upcomingSegment) return;
      if (item.isStart) {
        keys.add("start");
        return;
      }
      if (typeof item.aidStationIndex === "number" && !item.isFinish) {
        keys.add(String(item.aidStationIndex));
      }
    });
    return Array.from(keys);
  }, [renderItems]);
  const productById = useMemo(() => Object.fromEntries(fuelProducts.map((product) => [product.id, product])), [fuelProducts]);
  const finishSummary = useMemo(() => {
    if (segments.length === 0) return null;

    const finishDistanceKm = segments[segments.length - 1]?.distanceKm ?? 0;
    const totalPauseMinutes = segments.reduce((total, segment) => total + (segment.pauseMinutes ?? 0), 0);
    const totalMovingMinutes = raceTotals?.durationMinutes ?? 0;
    const totalTimeMinutes = totalMovingMinutes + totalPauseMinutes;
    const averagePaceMinPerKm =
      finishDistanceKm > 0 && totalTimeMinutes > 0 ? totalTimeMinutes / finishDistanceKm : null;
    const averageSpeedKph =
      finishDistanceKm > 0 && totalTimeMinutes > 0 ? finishDistanceKm / (totalTimeMinutes / 60) : null;
    const totalGels = segments.reduce((total, segment) => total + (segment.gelsPlanned ?? 0), 0);
    const totalElevationGain = segments.reduce((total, segment) => total + (segment.elevationGainM ?? 0), 0);
    const totalElevationLoss = segments.reduce((total, segment) => total + (segment.elevationLossM ?? 0), 0);
    const allSupplies = [...startSupplies, ...segments.flatMap((segment) => segment.supplies ?? [])];
    const totalCalories = allSupplies.reduce((total, supply) => {
      const product = productById[supply.productId];
      if (!product) return total;
      const quantity = Number.isFinite(supply.quantity) ? supply.quantity : 0;
      if (quantity <= 0) return total;
      return total + (product.caloriesKcal ?? 0) * quantity;
    }, 0);

    return {
      finishDistanceKm,
      totalPauseMinutes,
      totalMovingMinutes,
      totalTimeMinutes,
      averagePaceMinPerKm,
      averageSpeedKph,
      totalGels,
      totalElevationGain,
      totalElevationLoss,
      totalCalories,
    };
  }, [productById, raceTotals?.durationMinutes, segments, startSupplies]);
  const metricIcons = {
    carbs: (
      <Image
        src="/race-planner/icons/glucide.png"
        alt=""
        aria-hidden
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
      />
    ),
    water: (
      <Image
        src="/race-planner/icons/water.png"
        alt=""
        aria-hidden
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
      />
    ),
    sodium: (
      <Image
        src="/race-planner/icons/sodium.png"
        alt=""
        aria-hidden
        width={16}
        height={16}
        className="h-4 w-4 object-contain"
      />
    ),
  };
  const autoFillLocked = !allowAutoFill;
  const exportLocked = !allowExport;
  const isUpgradeBusy = upgradeStatus === "opening";
  const getPlanStatus = (planned: number, target: number, upperBound?: number) => {
    if (!Number.isFinite(target) || target <= 0) {
      return { label: timelineCopy.status.atTarget, tone: "neutral" as const };
    }
    const ceiling = Math.max(upperBound ?? target * 1.2, target);
    const ranges = buildGaugeRanges(target, ceiling);
    if (planned < ranges.lowerWarning) {
      return { label: timelineCopy.status.belowTarget, tone: "danger" as const };
    }
    if (planned < ranges.greenStart) {
      return { label: timelineCopy.status.belowTarget, tone: "warning" as const };
    }
    if (planned <= ranges.greenEnd) {
      return { label: timelineCopy.status.atTarget, tone: "success" as const };
    }
    if (planned <= ranges.upperDanger) {
      return { label: timelineCopy.status.aboveTarget, tone: "warning" as const };
    }
    return { label: timelineCopy.status.aboveTarget, tone: "danger" as const };
  };
  const toggleAidStationCollapse = (collapseKey: string) => {
    setCollapsedAidStations((current) => ({
      ...current,
      [collapseKey]: !current[collapseKey],
    }));
  };
  const hasCollapsibleAidStations = collapsibleKeys.length > 0;
  const areAllAidStationsCollapsed = hasCollapsibleAidStations
    ? collapsibleKeys.every((key) => collapsedAidStations[key])
    : false;
  const toggleAidStationsCollapseAll = () => {
    if (!hasCollapsibleAidStations) return;
    const nextValue = !areAllAidStationsCollapsed;
    setCollapsedAidStations((current) =>
      collapsibleKeys.reduce<Record<string, boolean>>((acc, key) => {
        acc[key] = nextValue;
        return acc;
      }, { ...current })
    );
  };
  const closeEditor = useCallback(() => {
    setEditorState(null);
    setEditorError(null);
  }, []);

  const handleEditorSave = useCallback(() => {
    if (!editorState) return;
    const name = editorState.name.trim();
    const distanceValue = Number(editorState.distance);
    const pauseValue =
      editorState.pauseMinutes === "" ? undefined : Number(editorState.pauseMinutes);
    if (!name) {
      setEditorError(copy.validation.required);
      return;
    }
    if (!Number.isFinite(distanceValue) || distanceValue < 0) {
      setEditorError(copy.validation.nonNegative);
      return;
    }
    if (pauseValue !== undefined && (!Number.isFinite(pauseValue) || pauseValue < 0)) {
      setEditorError(copy.validation.nonNegative);
      return;
    }
    if (editorState.mode === "edit") {
      setValue(`aidStations.${editorState.index}.name`, name);
      setValue(`aidStations.${editorState.index}.distanceKm`, distanceValue);
      setValue(`aidStations.${editorState.index}.pauseMinutes`, pauseValue);
    } else {
      onAddAidStation({ name, distanceKm: distanceValue });
    }
    closeEditor();
  }, [closeEditor, copy.validation.nonNegative, copy.validation.required, editorState, onAddAidStation, setValue]);

  const summarizeSupplies = (supplies?: StationSupply[]) => {
    const grouped: Record<string, { product: FuelProduct; quantity: number }> = {};
    supplies?.forEach((supply) => {
      const product = productById[supply.productId];
      if (!product) return;
      const safeQuantity = Number.isFinite(supply.quantity) ? supply.quantity : 0;
      if (safeQuantity <= 0) return;
      if (!grouped[product.id]) {
        grouped[product.id] = { product, quantity: 0 };
      }
      grouped[product.id].quantity += safeQuantity;
    });

    const items = Object.values(grouped).sort((a, b) => a.product.name.localeCompare(b.product.name));
    const totals = items.reduce(
      (acc, item) => ({
        carbs: acc.carbs + item.product.carbsGrams * item.quantity,
        water: acc.water + (item.product.waterMl ?? 0) * item.quantity,
        sodium: acc.sodium + item.product.sodiumMg * item.quantity,
      }),
      { carbs: 0, water: 0, sodium: 0 }
    );

    if (!items.length) return null;

    return { items, totals };
  };

  const getAidSupplies = useCallback(
    (aidStationIndex: number) => segments.find((seg) => seg.aidStationIndex === aidStationIndex)?.supplies ?? [],
    [segments]
  );
  const supplyPickerSupplies = useMemo(() => {
    if (!supplyPicker) return null;
    return supplyPicker.type === "start"
      ? startSupplies
      : typeof supplyPicker.index === "number"
        ? getAidSupplies(supplyPicker.index)
        : null;
  }, [getAidSupplies, startSupplies, supplyPicker]);
  const supplyPickerSelectedSlugs = useMemo(() => {
    if (!supplyPickerSupplies) return [];
    return supplyPickerSupplies
      .map((supply) => {
        const product = productById[supply.productId];
        return product?.slug;
      })
      .filter((slug): slug is string => Boolean(slug));
  }, [productById, supplyPickerSupplies]);

  const handleSupplyToggle = useCallback(
    (productSlug: string) => {
      if (!supplyPicker) return;
      const product = productBySlug[productSlug];
      if (!product) return;
      if (supplyPicker.type === "start") {
        const isSelected = supplyPickerSelectedSlugs.includes(productSlug);
        if (isSelected) {
          onStartSupplyRemove(product.id);
        } else {
          onStartSupplyDrop(product.id, 1);
        }
      } else if (typeof supplyPicker.index === "number") {
        const isSelected = supplyPickerSelectedSlugs.includes(productSlug);
        if (isSelected) {
          onSupplyRemove(supplyPicker.index, product.id);
        } else {
          onSupplyDrop(supplyPicker.index, product.id, 1);
        }
      }
    },
    [onStartSupplyDrop, onStartSupplyRemove, onSupplyDrop, onSupplyRemove, productBySlug, supplyPicker, supplyPickerSelectedSlugs]
  );
  const toggleFavorite = useCallback(
    (slug: string) => {
      const product = productBySlug[slug];
      if (!product) return;

      const result = onFavoriteToggle(product);
      if (!result.updated) return;

      setPickerFavorites((current) => {
        const exists = current.includes(slug);
        if (exists) return current.filter((item) => item !== slug);
        return [...current, slug];
      });
    },
    [onFavoriteToggle, productBySlug]
  );

  return (
    <>
      <Card id={sectionId}>
        <CardHeader className="space-y-3">
          <SectionHeader
            title={timelineCopy.title}
            description={timelineCopy.description}
            descriptionAsTooltip
          action={
            <div className="flex items-center gap-2">
              {hasCollapsibleAidStations ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={toggleAidStationsCollapseAll}
                  className="hidden sm:inline-flex"
                >
                  {areAllAidStationsCollapsed ? timelineCopy.expandAllLabel : timelineCopy.collapseAllLabel}
                </Button>
              ) : null}
              <Button type="button" onClick={openCreateEditor}>
                {aidStationsCopy.add}
              </Button>
              {segments.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={autoFillLocked ? () => onUpgrade("autoFill") : onAutomaticFill}
                  title={copy.buttons.autoFillHint}
                  disabled={autoFillLocked && isUpgradeBusy}
                >
                  <span className="flex items-center gap-1.5" title={autoFillLocked ? "Premium feature" : undefined}>
                    {autoFillLocked ? <PremiumSparklesIcon aria-hidden /> : null}
                    <span>{copy.buttons.autoFill}</span>
                  </span>
                </Button>
              ) : null}
              {segments.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="hidden sm:inline-flex"
                  onClick={exportLocked ? () => onUpgrade("print") : onPrint}
                  disabled={exportLocked && isUpgradeBusy}
                >
                  <span className="flex items-center gap-1.5" title={exportLocked ? "Premium feature" : undefined}>
                    {exportLocked ? <PremiumSparklesIcon aria-hidden /> : null}
                    <span>{copy.buttons.printPlan}</span>
                  </span>
                </Button>
              ) : null}
            </div>
          }
        />
        {segments.length === 0 ? (
          <p className="text-sm text-muted-foreground dark:text-slate-400">{timelineCopy.empty}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {canEditCoachComments ? (
          <CommentsPanel
            comments={coachComments}
            copy={coachCommentsCopy}
            contextOptions={commentContextOptions}
            onCreate={handleCreateCoachComment}
            onUpdate={handleUpdateCoachComment}
            onDelete={handleDeleteCoachComment}
            isCreating={isCoachCommentCreating}
            isUpdating={isCoachCommentUpdating}
            isDeleting={isCoachCommentDeleting}
            createError={coachCommentCreateError}
            updateError={coachCommentUpdateError}
            deleteError={coachCommentDeleteError}
          />
        ) : null}
        {planComments.length > 0 ? (
          <CoachCommentsBlock comments={planComments} copy={coachCommentsCopy} />
        ) : null}
        {segments.length > 0 ? (
          <div className="relative space-y-4">
            {(() => {
              return renderItems.map((item, itemIndex) => {
                const pointNumber = itemIndex + 1;
                const distanceFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.distanceKm` as const)
                    : null;
                const waterRefillFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.waterRefill` as const)
                    : null;
                const pauseMinutesValue =
                  typeof item.checkpointSegment?.pauseMinutes === "number" ? item.checkpointSegment.pauseMinutes : 0;
                const metaText = `${formatDistanceWithUnit(item.distanceKm)} · ${timelineCopy.etaLabel}: ${formatMinutes(item.etaMinutes)}`;

                const nextSegment = item.upcomingSegment;
                const supplies = item.isStart ? startSupplies : item.checkpointSegment?.supplies;
                const summarized = summarizeSupplies(supplies);
                const isCollapsible =
                  !!nextSegment && (item.isStart || (typeof item.aidStationIndex === "number" && !item.isFinish));
                const collapseKey = isCollapsible ? (item.isStart ? "start" : String(item.aidStationIndex)) : null;
                const isCollapsed = isCollapsible && collapseKey ? Boolean(collapsedAidStations[collapseKey]) : false;
                const toggleLabel = isCollapsed ? timelineCopy.expandLabel : timelineCopy.collapseLabel;
                const pointIconLarge = item.isStart ? (
                  <Image
                    src="/race-planner/icons/start.svg"
                    alt=""
                    aria-hidden
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain invert dark:invert-0"
                  />
                ) : typeof item.aidStationIndex === "number" && !item.isFinish ? (
                  <Image
                    src="/race-planner/icons/ravito.svg"
                    alt=""
                    aria-hidden
                    width={32}
                    height={32}
                    className="h-8 w-8 object-contain invert dark:invert-0"
                  />
                ) : null;
                const titleContent = item.title;
                const isAidStation = typeof item.aidStationIndex === "number" && !item.isFinish;
                const commentContextKey = item.isStart
                  ? "start"
                  : item.isFinish
                    ? "finish"
                    : typeof item.aidStationIndex === "number"
                      ? `aid-${item.aidStationIndex}`
                      : "plan";
                const contextComments = commentsByContext.get(commentContextKey) ?? [];
                const aidStationBadge = item.isStart ? (
                  <AidStationBadge step={pointNumber} variant="start" />
                ) : isAidStation ? (
                  <AidStationBadge step={pointNumber} variant="ravito" />
                ) : null;
                const metaContent = (
                  <div className="space-y-1">
                    <div>{metaText}</div>
                    <div className="text-[11px] text-muted-foreground dark:text-slate-400">
                      {timelineCopy.pauseLabel}: {pauseMinutesValue}
                    </div>
                  </div>
                );
                const toggleButton =
                  isCollapsible && collapseKey ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 rounded-full border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-800/60"
                      onClick={() => toggleAidStationCollapse(collapseKey)}
                      aria-label={toggleLabel}
                      title={toggleLabel}
                    >
                      {isCollapsed ? (
                        <ChevronDownIcon className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  ) : null;

                const waterRefillToggle =
                  distanceFieldName && !isCollapsed && waterRefillFieldName ? (
                    <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground dark:bg-slate-900/60 dark:text-slate-200">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-background text-emerald-500 focus:ring-ring dark:bg-slate-900"
                        {...register(waterRefillFieldName)}
                      />
                      <span>{aidStationsCopy.labels.waterRefill}</span>
                    </label>
                  ) : null;
                const suppliesDropZone =
                  (item.isStart || typeof item.aidStationIndex === "number") && !isCollapsed ? (
                    <div
                      className="flex w-full flex-1 flex-col gap-2 rounded-2xl border border-dashed border-emerald-400/50 bg-emerald-500/5 p-2 shadow-inner shadow-emerald-500/10"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const productId = event.dataTransfer.getData("text/trailplanner-product-id");
                        const quantity = Number(event.dataTransfer.getData("text/trailplanner-product-qty")) || 1;
                        if (!productId) return;
                        if (item.isStart) {
                          onStartSupplyDrop(productId, quantity);
                        } else {
                          onSupplyDrop(item.aidStationIndex as number, productId, quantity);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-1 flex-wrap gap-2">
                          {summarized?.items?.length
                            ? summarized.items.map(({ product, quantity }) => (
                                <div
                                  key={product.id}
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-card px-3 py-1 text-sm text-foreground dark:bg-slate-950/70 dark:text-slate-50"
                                >
                                  <span className="font-semibold">{`${product.name} x${quantity}`}</span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-6 w-6 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
                                      onClick={() => {
                                        if (quantity <= 1) {
                                          if (item.isStart) {
                                            onStartSupplyRemove(product.id);
                                          } else {
                                            onSupplyRemove(item.aidStationIndex as number, product.id);
                                          }
                                          return;
                                        }
                                        if (item.isStart) {
                                          onStartSupplyRemove(product.id);
                                          onStartSupplyDrop(product.id, quantity - 1);
                                        } else {
                                          onSupplyRemove(item.aidStationIndex as number, product.id);
                                          onSupplyDrop(item.aidStationIndex as number, product.id, quantity - 1);
                                        }
                                      }}
                                    >
                                      –
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="h-6 w-6 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground dark:bg-slate-900/80 dark:text-slate-200 dark:hover:text-white"
                                      onClick={() => {
                                        if (item.isStart) {
                                          onStartSupplyDrop(product.id, 1);
                                        } else {
                                          onSupplyDrop(item.aidStationIndex as number, product.id, 1);
                                        }
                                      }}
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                              ))
                            : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {waterRefillToggle}
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 w-9 shrink-0 rounded-full border-emerald-400/50 bg-background p-0 text-emerald-700 hover:bg-emerald-500/10 dark:bg-slate-950/60 dark:text-emerald-50"
                            onClick={() =>
                              setSupplyPicker({
                                type: item.isStart ? "start" : "aid",
                                index: item.isStart ? undefined : (item.aidStationIndex as number),
                              })
                            }
                            aria-label={timelineCopy.pickupTitle}
                            title={timelineCopy.pickupTitle}
                          >
                            +
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null;

                const sectionSegment = nextSegment;
                const plannedFuel = summarized?.totals.carbs ?? 0;
                const plannedSodium = summarized?.totals.sodium ?? 0;
                const plannedWater = sectionSegment?.plannedWaterMl ?? 0;
                const paceAdjustmentFieldName = sectionSegment
                  ? getSegmentFieldName(sectionSegment, "paceAdjustmentMinutesPerKm")
                  : null;
                const adjustmentStep = 0.25;
                const basePaceMinutesPerKm =
                  sectionSegment && sectionSegment.segmentKm > 0
                    ? sectionSegment.estimatedSegmentMinutes / sectionSegment.segmentKm
                    : 0;
                const paceMinutesPerKm =
                  basePaceMinutesPerKm + (sectionSegment?.paceAdjustmentMinutesPerKm ?? 0);
                const paceAdjustmentControl =
                  sectionSegment && paceAdjustmentFieldName ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 dark:bg-slate-950/50">
                      <input
                        type="hidden"
                        {...register(paceAdjustmentFieldName, {
                          setValueAs: parseOptionalNumber,
                        })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-6 w-6 rounded-full border border-border px-0 text-muted-foreground hover:text-foreground dark:text-slate-200 dark:hover:text-white"
                        onClick={() => {
                          const nextPace = Number((paceMinutesPerKm - adjustmentStep).toFixed(2));
                          const nextValue = Number((nextPace - basePaceMinutesPerKm).toFixed(2));
                          setValue(paceAdjustmentFieldName, nextValue, {
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                        }}
                      >
                        –
                      </Button>
                      <div className="flex items-baseline gap-1 px-1">
                        <span className="text-[13px] font-semibold text-foreground tabular-nums dark:text-slate-50">
                          {formatPaceValue(paceMinutesPerKm)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-6 w-6 rounded-full border border-border px-0 text-muted-foreground hover:text-foreground dark:text-slate-200 dark:hover:text-white"
                        onClick={() => {
                          const nextPace = Number((paceMinutesPerKm + adjustmentStep).toFixed(2));
                          const nextValue = Number((nextPace - basePaceMinutesPerKm).toFixed(2));
                          setValue(paceAdjustmentFieldName, nextValue, {
                            shouldDirty: true,
                            shouldTouch: true,
                          });
                        }}
                      >
                        +
                      </Button>
                    </div>
                  ) : null;
                const metrics = sectionSegment
                  ? [
                      {
                        key: "carbs" as const,
                        label: timelineCopy.gelsBetweenLabel,
                        planned: plannedFuel,
                        target: sectionSegment.targetFuelGrams,
                        total: raceTotals?.fuelGrams,
                        format: formatFuelAmount,
                      },
                      {
                        key: "water" as const,
                        label: copy.sections.summary.items.water,
                        planned: plannedWater,
                        target: sectionSegment.targetWaterMl,
                        total: raceTotals?.waterMl,
                        format: formatWaterAmount,
                      },
                      {
                        key: "sodium" as const,
                        label: copy.sections.summary.items.sodium,
                        planned: plannedSodium,
                        target: sectionSegment.targetSodiumMg,
                        total: raceTotals?.sodiumMg,
                        format: formatSodiumAmount,
                      },
                    ]
                  : [];

                const inlineMetrics = metrics.map((metric) => {
                  const targetValue = Math.max(metric.target, 0);
                  const maxValueCandidate =
                    metric.key === "water" &&
                    sectionSegment &&
                    typeof sectionSegment.waterCapacityMl === "number" &&
                    sectionSegment.waterCapacityMl > 0
                      ? sectionSegment.waterCapacityMl
                      : targetValue * 1.2;
                  const upperBound = Math.max(maxValueCandidate, targetValue || 1);
                  const status = getPlanStatus(metric.planned, targetValue, upperBound);
                  const capacityLabel =
                    metric.key === "water" &&
                    sectionSegment &&
                    typeof sectionSegment.waterCapacityMl === "number" &&
                    sectionSegment.waterCapacityMl > 0
                      ? timelineCopy.waterCapacityLabel.replace(
                          "{capacity}",
                          formatWaterAmount(sectionSegment.waterCapacityMl)
                        )
                      : null;
                  const capacityWarning =
                    metric.key === "water" &&
                    sectionSegment &&
                    typeof sectionSegment.waterShortfallMl === "number" &&
                    sectionSegment.waterShortfallMl > 0
                      ? timelineCopy.waterCapacityWarning.replace(
                          "{missing}",
                          formatWaterAmount(sectionSegment.waterShortfallMl)
                        )
                      : null;
                  return {
                    key: metric.key,
                    label: metric.label,
                    name:
                      metric.key === "carbs"
                        ? copy.sections.summary.items.carbs
                        : metric.key === "water"
                          ? copy.sections.summary.items.water
                          : copy.sections.summary.items.sodium,
                    value: metric.format(metric.planned),
                    plannedValue: metric.planned,
                    format: metric.format,
                    targetValue: metric.target,
                    helper: capacityWarning ?? capacityLabel ?? null,
                    statusLabel: status.label,
                    statusTone: status.tone,
                    icon: metricIcons[metric.key],
                  };
                });

                const segmentCard =
                  sectionSegment && inlineMetrics.length > 0 ? (
                    <SegmentCard
                      variant="compactChip"
                      distanceText={`${sectionSegment.segmentKm.toFixed(1)} km`}
                      timeText={formatMinutes(sectionSegment.segmentMinutes)}
                      elevationGainText={`${Math.round(sectionSegment.elevationGainM ?? 0)} D+`}
                      elevationLossText={`${Math.round(sectionSegment.elevationLossM ?? 0)} D-`}
                      paceControl={paceAdjustmentControl}
                    />
                  ) : null;

                const nutritionCards = inlineMetrics.map((metric) => (
                  <NutritionCard
                    key={metric.key}
                    metric={metric}
                    variant="compact"
                    waterCapacityMl={sectionSegment?.waterCapacityMl ?? null}
                    targetLabel={timelineCopy.targetLabel}
                  />
                ));

                const sectionContent =
                  sectionSegment && inlineMetrics.length > 0 && segmentCard ? (
                    <SectionRow segment={segmentCard} nutritionCards={nutritionCards} />
                  ) : null;

                const removeButton =
                  typeof item.aidStationIndex === "number" && !item.isFinish ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 rounded-full border border-red-200 bg-red-100 px-0 text-lg font-bold text-red-950 hover:bg-red-200 dark:border-red-500/50 dark:bg-red-500/10 dark:text-white dark:hover:bg-red-500/20"
                      onClick={() => onRemoveAidStation(item.aidStationIndex as number)}
                    >
                      <span aria-hidden>×</span>
                      <span className="sr-only">
                        {aidStationsCopy.remove} {item.title}
                      </span>
                    </Button>
                  ) : null;

                if (item.isFinish && finishSummary) {
                  const totalTimeValue =
                    finishSummary.totalTimeMinutes > 0 ? formatMinutes(finishSummary.totalTimeMinutes) : "—";
                  const totalPauseNote =
                    finishSummary.totalPauseMinutes > 0
                      ? timelineCopy.finishSummary.pauseNote.replace(
                          "{pause}",
                          formatMinutes(finishSummary.totalPauseMinutes)
                        )
                      : null;
                  const totalCarbs = raceTotals?.fuelGrams ?? 0;
                  const totalWater = raceTotals?.waterMl ?? 0;
                  const totalSodium = raceTotals?.sodiumMg ?? 0;
                  const carbsPerHour =
                    totalCarbs > 0 && finishSummary.totalTimeMinutes > 0
                      ? totalCarbs / (finishSummary.totalTimeMinutes / 60)
                      : null;
                  const formatOptionalValue = (value: number | null, formatter: (value: number) => string) =>
                    Number.isFinite(value) && (value ?? 0) > 0 ? formatter(value as number) : "—";
                  const formatCarbs = (value: number) => `${Math.round(value)} ${copy.units.grams}`;
                  const formatSodium = (value: number) => `${Math.round(value)} ${copy.units.milligrams}`;
                  const formatWater = (value: number) => {
                    if (!Number.isFinite(value) || value <= 0) return "—";
                    if (value >= 1000) {
                      const liters = value / 1000;
                      return `${liters.toFixed(liters < 10 ? 1 : 0)} L`;
                    }
                    return `${Math.round(value)} ${copy.units.milliliters}`;
                  };
                  const formatPace = (value: number | null) => {
                    if (!Number.isFinite(value) || (value ?? 0) <= 0) return "—";
                    const totalSeconds = Math.round((value as number) * 60);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    return `${minutes}:${seconds.toString().padStart(2, "0")} /${copy.units.kilometer}`;
                  };
                  const formatSpeed = (value: number | null) =>
                    formatOptionalValue(value, (speed) =>
                      `${speed.toFixed(1)} ${copy.units.kilometer}/${copy.units.hourShort}`
                    );
                  const formattedGels =
                    Number.isFinite(finishSummary.totalGels) && finishSummary.totalGels > 0
                      ? Number.isInteger(finishSummary.totalGels)
                        ? finishSummary.totalGels.toFixed(0)
                        : finishSummary.totalGels.toFixed(1)
                      : "—";
                  const formattedCalories =
                    Number.isFinite(finishSummary.totalCalories) && finishSummary.totalCalories > 0
                      ? `${Math.round(finishSummary.totalCalories)} kcal`
                      : "—";
                  const formattedElevationGain =
                    Number.isFinite(finishSummary.totalElevationGain) && finishSummary.totalElevationGain > 0
                      ? `${Math.round(finishSummary.totalElevationGain)} ${copy.units.meter}`
                      : "—";
                  const formattedElevationLoss =
                    Number.isFinite(finishSummary.totalElevationLoss) && finishSummary.totalElevationLoss > 0
                      ? `${Math.round(finishSummary.totalElevationLoss)} ${copy.units.meter}`
                      : "—";
                  const performanceGroup: FinishSummaryGroup = {
                    title: timelineCopy.finishSummary.groups.performance,
                    icon: <GaugeIcon className="h-4 w-4" aria-hidden />,
                    primary: {
                      key: "total-time",
                      label: timelineCopy.finishSummary.totalTimeLabel,
                      value: totalTimeValue,
                      helper: totalPauseNote,
                    },
                    secondary: [
                      {
                        key: "avg-pace",
                        label: timelineCopy.finishSummary.avgPaceLabel,
                        value: formatPace(finishSummary.averagePaceMinPerKm),
                      },
                      {
                        key: "avg-speed",
                        label: timelineCopy.finishSummary.avgSpeedLabel,
                        value: formatSpeed(finishSummary.averageSpeedKph),
                      },
                    ],
                  };

                  const energyGroup: FinishSummaryGroup = {
                    title: timelineCopy.finishSummary.groups.energy,
                    icon: <BoltIcon className="h-4 w-4" aria-hidden />,
                    primary: {
                      key: "total-carbs",
                      label: timelineCopy.finishSummary.totalCarbsLabel,
                      value: formatOptionalValue(totalCarbs, formatCarbs),
                      helper:
                        carbsPerHour && Number.isFinite(carbsPerHour)
                          ? `${Math.round(carbsPerHour)} ${copy.units.grams}/${copy.units.hourShort}`
                          : null,
                    },
                    secondary: [
                      {
                        key: "total-gels",
                        label: timelineCopy.finishSummary.totalGelsLabel,
                        value: formattedGels,
                      },
                      {
                        key: "total-calories",
                        label: timelineCopy.finishSummary.totalCaloriesLabel,
                        value: formattedCalories,
                      },
                    ],
                  };

                  const hydrationGroup: FinishSummaryGroup = {
                    title: timelineCopy.finishSummary.groups.hydration,
                    icon: <DropletIcon className="h-4 w-4" aria-hidden />,
                    primary: {
                      key: "total-fluids",
                      label: timelineCopy.finishSummary.totalFluidsLabel,
                      value: formatWater(totalWater),
                    },
                    secondary: [
                      {
                        key: "total-sodium",
                        label: timelineCopy.finishSummary.totalSodiumLabel,
                        value: formatOptionalValue(totalSodium, formatSodium),
                      },
                    ],
                  };

                  const details: FinishSummaryMetric[] = [
                    {
                      key: "elevation-gain",
                      label: timelineCopy.finishSummary.elevationGainLabel,
                      value: formattedElevationGain,
                    },
                    {
                      key: "elevation-loss",
                      label: timelineCopy.finishSummary.elevationLossLabel,
                      value: formattedElevationLoss,
                    },
                  ];

                  return (
                    <div key={item.id} className="relative pl-8">
                      <FinishSummaryCard
                        pointIndex={pointNumber}
                        title={timelineCopy.finishSummary.title}
                        distanceText={formatDistanceWithUnit(finishSummary.finishDistanceKm)}
                        performanceGroup={performanceGroup}
                        energyGroup={energyGroup}
                        hydrationGroup={hydrationGroup}
                        details={details}
                        detailsLabel={timelineCopy.finishSummary.detailsLabel}
                        detailsId={finishDetailsId}
                        isExpanded={isFinishDetailsOpen}
                        onToggleDetails={() => setIsFinishDetailsOpen((prev) => !prev)}
                      />
                      {contextComments.length > 0 ? (
                        <div className="mt-3">
                          <CoachCommentsBlock comments={contextComments} copy={coachCommentsCopy} />
                        </div>
                      ) : null}
                    </div>
                  );
                }

                if (isCollapsible && isCollapsed) {
                  const embarkedSupplies = summarized?.items ?? [];
                  const countEmbarked = (predicate: (item: (typeof embarkedSupplies)[number]) => boolean) =>
                    embarkedSupplies.reduce((total, item) => total + (predicate(item) ? item.quantity : 0), 0);
                  const glucideCount = countEmbarked((item) => item.product.carbsGrams > 0);
                  const waterCount = countEmbarked((item) => (item.product.waterMl ?? 0) > 0);
                  const sodiumCount = countEmbarked(
                    (item) => item.product.carbsGrams <= 0 && item.product.sodiumMg > 0
                  );
                  const formatItemCount = (count: number, singular: string, plural: string) =>
                    `${count} ${count === 1 ? singular : plural}`;
                  const embarkedItems: EmbarkedSummaryItem[] = [
                    {
                      key: "carbs",
                      label: copy.sections.summary.items.carbs,
                      value: formatItemCount(glucideCount, "gel", "gels"),
                      dotClassName: "bg-rose-400",
                    },
                    {
                      key: "water",
                      label: copy.sections.summary.items.water,
                      value: formatItemCount(waterCount, "flask", "flasks"),
                      dotClassName: "bg-sky-400",
                    },
                    {
                      key: "sodium",
                      label: copy.sections.summary.items.sodium,
                      value: formatItemCount(sodiumCount, "cap", "caps"),
                      dotClassName: "bg-amber-400",
                    },
                  ];
                  return (
                    <div key={item.id} className="relative pl-8">
                      <AidStationCollapsedRow
                        pointIndex={pointNumber}
                        badge={aidStationBadge ?? undefined}
                        title={item.title}
                        leftIcon={isAidStation ? undefined : pointIconLarge}
                        metaLine={`${formatDistanceWithUnit(item.distanceKm)} · ${timelineCopy.etaLabel}: ${formatMinutes(item.etaMinutes)}`}
                        pauseLine={`${timelineCopy.pauseLabel}: ${pauseMinutesValue}`}
                        segmentCard={segmentCard}
                        embarkedItems={embarkedItems}
                        actions={
                          <div className="flex items-center gap-3">
                            {toggleButton}
                            {removeButton}
                          </div>
                        }
                      />
                      {contextComments.length > 0 ? (
                        <div className="mt-3">
                          <CoachCommentsBlock comments={contextComments} copy={coachCommentsCopy} />
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="relative pl-8">
                    <div className="space-y-3">
                      <AidStationHeaderRow
                        pointIndex={pointNumber}
                        badge={aidStationBadge ?? undefined}
                        title={titleContent}
                        meta={metaContent}
                        finishLabel={copy.defaults.finish}
                        isFinish={item.isFinish}
                        headerMiddle={suppliesDropZone}
                        headerActions={
                          isCollapsible ? (
                            <div className="flex items-center gap-3">
                              {toggleButton}
                              {removeButton}
                            </div>
                          ) : (
                            removeButton
                          )
                        }
                        onTitleClick={
                          typeof item.aidStationIndex === "number"
                              ? () =>
                                  setEditorState({
                                    mode: "edit",
                                    index: item.aidStationIndex as number,
                                    name: item.title,
                                    distance: String(item.distanceKm ?? 0),
                                    pauseMinutes:
                                      typeof item.checkpointSegment?.pauseMinutes === "number"
                                        ? String(item.checkpointSegment.pauseMinutes)
                                        : "",
                                  })
                            : undefined
                        }
                      />
                      {contextComments.length > 0 ? (
                        <CoachCommentsBlock comments={contextComments} copy={coachCommentsCopy} />
                      ) : null}
                      {sectionContent ? <div className="relative">{sectionContent}</div> : null}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : null}
        </CardContent>
      </Card>
      {editorState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-border-strong bg-card p-5 shadow-2xl dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground dark:text-slate-50">
                {editorState.mode === "edit" ? aidStationsCopy.title : aidStationsCopy.add}
              </p>
              <Button variant="ghost" className="h-8 px-2" onClick={closeEditor}>
                ✕
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground dark:text-slate-300">
                  {aidStationsCopy.labels.name}
                </Label>
                <Input
                  value={editorState.name}
                  onChange={(event) => updateEditorField("name", event.target.value)}
                  className="border-border bg-background text-sm font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground dark:text-slate-300">
                  {aidStationsCopy.labels.distance}
                </Label>
                <Input
                  value={editorState.distance}
                  onChange={(event) => updateEditorField("distance", event.target.value)}
                  type="number"
                  step="0.5"
                  min="0"
                  className="border-border bg-background text-sm font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                />
              </div>
              {editorState.mode === "edit" ? (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground dark:text-slate-300">
                    {timelineCopy.pauseLabel}
                  </Label>
                  <Input
                    value={editorState.pauseMinutes}
                    onChange={(event) => updateEditorField("pauseMinutes", event.target.value)}
                    type="number"
                    step="1"
                    min="0"
                    className="border-border bg-background text-sm font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                  />
                </div>
              ) : null}
              {editorError ? <p className="text-xs text-amber-200">{editorError}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={closeEditor}>
                Cancel
              </Button>
              <Button onClick={handleEditorSave}>Save</Button>
            </div>
          </div>
        </div>
      ) : null}
      {supplyPicker ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6">
          <div className="w-full max-w-5xl space-y-4 rounded-2xl border border-border-strong bg-card p-5 shadow-2xl dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground dark:text-slate-50">
                  {copy.sections.gels.title}
                </p>
                <p className="text-sm text-muted-foreground dark:text-slate-300">
                  {copy.sections.gels.description}
                </p>
              </div>
              <Button variant="ghost" className="h-8 px-2" onClick={() => setSupplyPicker(null)}>
                ✕
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder={copy.sections.gels.filters.searchPlaceholder}
                className="w-full max-w-md border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="fuelTypeFilter" className="text-xs text-muted-foreground dark:text-slate-300">
                    {copy.sections.gels.filters.typeLabel}
                  </Label>
                  <select
                    id="fuelTypeFilter"
                    value={pickerFuelType}
                    onChange={(event) => setPickerFuelType(event.target.value as FuelType | "all")}
                    className="h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:bg-slate-900 dark:text-slate-50"
                  >
                    <option value="all">{copy.sections.gels.filters.typeAll}</option>
                    {fuelTypeValues.map((value) => (
                      <option key={value} value={value}>
                        {getFuelTypeLabel(value, locale)}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground dark:text-slate-300">
                  {`${pickerFavorites.length}/3 favoris sélectionnés`}
                </p>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-x-auto overflow-y-auto rounded-xl border border-border bg-card dark:bg-slate-950/60">
              <table className="min-w-[720px] w-full text-left text-sm text-foreground dark:text-slate-200">
                <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground dark:bg-slate-900/70 dark:text-slate-400">
                  <tr>
                    {[
                      { key: "favorite", label: "★" },
                      { key: "name", label: "Nom" },
                      { key: "type", label: copy.sections.gels.table.type },
                      { key: "carbs", label: "Glucides (g)" },
                      { key: "sodium", label: "Sodium (mg)" },
                      { key: "calories", label: "Calories" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 cursor-pointer select-none"
                        onClick={() =>
                          setPickerSort((current) => ({
                            key: col.key as typeof pickerSort.key,
                            dir: current.key === col.key && current.dir === "asc" ? "desc" : "asc",
                          }))
                        }
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {pickerSort.key === col.key ? (pickerSort.dir === "asc" ? "↑" : "↓") : null}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Sélectionner</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPickerProducts
                    .sort((a, b) => {
                      const dir = pickerSort.dir === "asc" ? 1 : -1;
                      if (pickerSort.key === "favorite") {
                        const aFav = Number(pickerFavoriteSet.has(a.slug));
                        const bFav = Number(pickerFavoriteSet.has(b.slug));
                        if (aFav === bFav) return 0;
                        return pickerSort.dir === "asc" ? aFav - bFav : bFav - aFav;
                      }
                      if (pickerSort.key === "name") return a.name.localeCompare(b.name) * dir;
                      if (pickerSort.key === "type") return a.fuelType.localeCompare(b.fuelType) * dir;
                      if (pickerSort.key === "carbs") return (a.carbsGrams - b.carbsGrams) * dir;
                      if (pickerSort.key === "sodium") return (a.sodiumMg - b.sodiumMg) * dir;
                      return (a.caloriesKcal - b.caloriesKcal) * dir;
                    })
                    .map((product) => {
                      const isSelected = supplyPickerSelectedSlugs.includes(product.slug);
                      const isFavorite = pickerFavoriteSet.has(product.slug);
                      return (
                        <tr key={product.slug} className="border-t border-border">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className={`text-lg ${isFavorite ? "text-amber-500" : "text-muted-foreground"} hover:text-amber-400 dark:${isFavorite ? "text-amber-300" : "text-slate-500"} dark:hover:text-amber-200`}
                              onClick={() => toggleFavorite(product.slug)}
                              aria-label="Favori"
                            >
                              ★
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold">{product.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <FuelTypeBadge fuelType={product.fuelType} locale={locale} />
                          </td>
                          <td className="px-4 py-3">{product.carbsGrams} g</td>
                          <td className="px-4 py-3">{product.sodiumMg} mg</td>
                          <td className="px-4 py-3">{product.caloriesKcal}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              className="h-8 px-3 text-xs"
                              onClick={() => handleSupplyToggle(product.slug)}
                            >
                              {isSelected ? "Sélectionné" : "Sélectionner"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
