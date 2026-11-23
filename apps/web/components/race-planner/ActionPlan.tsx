"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode, SVGProps } from "react";
import type { Path, UseFormRegister, UseFormSetValue } from "react-hook-form";

import type { RacePlannerTranslations } from "../../locales/types";
import type {
  ElevationPoint,
  FormValues,
  OrganizerAidStationProductSuggestion,
  SectionSegment,
  Segment,
  SegmentPlan,
  StationSupply,
} from "../../app/(planner)/race-planner/types";
import {
  adjustedPaceMinutesPerKm as getAdjustedPaceMinutesPerKm,
  estimateEffortDurationSeconds,
} from "../../app/(planner)/race-planner/utils/pacing";
import { autoSegmentSection, type SegmentPreset } from "../../app/(planner)/race-planner/utils/segmentation";
import { buildSectionKey } from "../../app/(planner)/race-planner/utils/section-segments";
import { getElevationSlice } from "../../app/(planner)/race-planner/utils/elevation-slice";
import { SubSectionElevationChart } from "../../app/(planner)/race-planner/components/SubSectionElevationChart";
import type { FuelProduct } from "../../lib/product-types";
import type { StoredProductPreference } from "../../lib/product-preferences";
import { fuelTypeValues, type FuelType } from "../../lib/fuel-types";
import { useI18n } from "../../app/i18n-provider";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionHeader } from "../ui/SectionHeader";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { AidStationBadge } from "./AidStationBadge";
import { AddMarkerModal } from "./AddMarkerModal";
import { AutoSegmentModal } from "./AutoSegmentModal";
import { EditSubSectionModal } from "./EditSubSectionModal";
import { FuelTypeBadge, getFuelTypeLabel } from "../products/FuelTypeBadge";
import { isVerifiedProduct, VerifiedProductBadge } from "../products/VerifiedProductBadge";
import { useActionPlanDerivedData } from "./useActionPlanDerivedData";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SaltIcon,
  SparklesIcon,
} from "./TimelineIcons";
import {
  DescentIcon,
  HydrationIcon,
  NutritionIcon,
  PaceIcon,
  SummitIcon,
} from "@pace-yourself/design-system/icons";
import { planFontVariables } from "./plan-fonts";

const statusToneStyles = {
  success: "border-emerald-400/40 bg-emerald-500/20 text-emerald-50",
  warning: "border-amber-400/40 bg-amber-500/15 text-amber-50",
  danger: "border-rose-400/40 bg-rose-500/20 text-rose-50",
  neutral: "border-slate-400/40 bg-slate-600/20 text-slate-50",
} as const;

const Trash2 = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const Pencil = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7 21H3v-4L17 3z" />
    <path d="M16 5l3 3" />
  </svg>
);

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
  sectionSegments?: Record<string, SectionSegment[]>;
  elevationProfile: ElevationPoint[];
  baseMinutesPerKm: number | null;
  fatigueLevel: number;
  raceTotals: RaceTotals | null;
  sectionId: string;
  onPrintAssistance: () => void;
  onAutomaticFill: (options?: { useOrganizerProducts?: boolean }) => void;
  onAddAidStation: (station: { name: string; distanceKm: number; waterRefill?: boolean; solidRefill?: boolean; assistanceAllowed?: boolean }) => void;
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
  localProductIds?: string[];
  organizerAidStationProducts?: Record<string, OrganizerAidStationProductSuggestion[]>;
  startSupplies: StationSupply[];
  onStartSupplyDrop: (productId: string, quantity?: number) => void;
  onStartSupplyRemove: (productId: string) => void;
  onSupplyDrop: (
    aidStationIndex: number,
    productId: string,
    quantity?: number,
    options?: { source?: StationSupply["source"] }
  ) => void;
  onSupplyRemove: (aidStationIndex: number, productId: string) => void;
  allowAutoFill: boolean;
  allowExport: boolean;
  premiumCopy: RacePlannerTranslations["account"]["premium"];
  onUpgrade: (reason: "autoFill" | "print") => void;
  upgradeStatus: "idle" | "opening";
  /**
   * Free preview (visitor or free account): the first `editableItemCount` points (departure, first aid
   * station) stay interactive, the rest of the timeline is shown blurred and inert behind `lockedCta`, and
   * the header actions (add aid station, auto-fill, print) call `onLockedAction` instead of acting.
   */
  sampleMode?: {
    editableItemCount: number;
    /** Receives the number of aid stations hidden behind the lock (finish excluded). */
    lockedCta: (lockedAidStationCount: number) => ReactNode;
    onLockedAction: () => void;
  };
};

/** « 11,0 » in French, « 11.0 » in English: kilometre posts always show one decimal. */
const formatKmPost = (value: number, locale: string) =>
  (Number.isFinite(value) ? value : 0).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

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
  badge?: ReactNode;
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
    <div className="min-w-0 py-3 sm:px-5 sm:py-1 sm:first:pl-0">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#C8D44E]">
        <span className="shrink-0" aria-hidden>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="mt-2 text-[12px] text-[#FAF8F2]/60">{primary.label}</p>
      <p className="font-[family-name:var(--font-plan-mono)] text-[28px] font-bold leading-tight tracking-tight tabular-nums text-[#FAF8F2]">
        {primary.value}
      </p>
      {primary.helper ? <p className="text-[12px] text-[#FAF8F2]/60">{primary.helper}</p> : null}
      {secondary?.length ? (
        <dl className="mt-3 space-y-1 text-[12.5px]">
          {secondary.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <dt className="text-[#FAF8F2]/60">{item.label}</dt>
              <dd className="font-[family-name:var(--font-plan-mono)] font-semibold tabular-nums text-[#FAF8F2]">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function FinishSummaryCard({
  pointIndex,
  badge,
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
    <div className="relative overflow-hidden rounded-2xl bg-[#1F3810] p-5 text-[#FAF8F2] shadow-[0_18px_40px_-22px_rgba(31,56,16,0.9)] sm:p-6">
      {/* Perforated edge of a race bib / finisher ticket. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2 bg-[radial-gradient(circle_at_8px_0,#FAF8F2_4px,transparent_4.5px)] bg-[length:16px_8px] bg-repeat-x opacity-90"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-[family-name:var(--font-plan-display)] text-2xl font-semibold tracking-tight">{title}</p>
        <p className="font-[family-name:var(--font-plan-mono)] text-sm font-semibold tabular-nums text-[#C8D44E]">{distanceText}</p>
      </div>

      <div className="mt-4 grid divide-y divide-dashed divide-[#FAF8F2]/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <SummaryGroup {...performanceGroup} />
        <SummaryGroup {...energyGroup} />
        <SummaryGroup {...hydrationGroup} />
      </div>

      <div className="mt-4 border-t border-dashed border-[#FAF8F2]/15 pt-3">
        <button
          type="button"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-[13px] font-semibold text-[#FAF8F2]/80 hover:text-[#FAF8F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8D44E]"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          onClick={onToggleDetails}
        >
          {detailsLabel}
          {isExpanded ? <ChevronUpIcon className="h-4 w-4" aria-hidden /> : <ChevronDownIcon className="h-4 w-4" aria-hidden />}
        </button>

        {isExpanded ? (
          <dl id={detailsId} className="mt-2 grid gap-x-6 gap-y-1.5 px-2 sm:grid-cols-2 lg:grid-cols-3">
            {details.map((detail) => (
              <div key={detail.key} className="flex items-center justify-between gap-2 text-[12.5px]">
                <dt className="text-[#FAF8F2]/60">{detail.label}</dt>
                <dd className="font-[family-name:var(--font-plan-mono)] font-semibold tabular-nums">{detail.value}</dd>
              </div>
            ))}
          </dl>
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

const buildAidStationProductKey = (name: string, distanceKm: number) =>
  `${name.trim().toLowerCase()}|${Number(distanceKm.toFixed(2))}`;

const buildSourceAidStationProductKey = (sourceAidStationId: string) => `source:${sourceAidStationId}`;

const getOrganizerSuggestionsForAidStation = (
  organizerProducts: Record<string, OrganizerAidStationProductSuggestion[]> | undefined,
  station: { name: string; distanceKm: number; sourceAidStationId?: string }
) => {
  if (station.sourceAidStationId) {
    const sourceSuggestions = organizerProducts?.[buildSourceAidStationProductKey(station.sourceAidStationId)];
    if (sourceSuggestions?.length) return sourceSuggestions;
  }

  return organizerProducts?.[buildAidStationProductKey(station.name, station.distanceKm)] ?? [];
};

const PremiumSparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <SparklesIcon
    className="h-3.5 w-3.5 text-muted-foreground dark:text-slate-100/60"
    strokeWidth={2}
    {...props}
  />
);

type SegmentCardVariant = "default" | "compact" | "compactChip" | "section";

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
  const isCompactChip = variant === "compactChip";
  const isSection = variant === "section";
  // « 184 D+ » / « D+ 184 » → « 184 m »: the climb/descent icons carry the meaning.
  const elevationNumber = (text: string) => `${text.replace(/D[+-]/g, "").trim()} m`;
  return (
    <div
      className={`flex min-w-0 flex-col gap-2.5 rounded-[10px] bg-white ring-1 ring-[#E5E2D8] ${
        isCompactChip ? "w-[180px] px-3 py-2" : "px-3.5 py-3"
      } ${
        isSection
          ? "sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 xl:h-full xl:flex-col xl:flex-nowrap xl:items-stretch xl:justify-between xl:gap-2.5 sm:[&>*:nth-child(3)]:ml-auto sm:[&>*:nth-child(3)]:border-0 sm:[&>*:nth-child(3)]:pt-0 xl:[&>*:nth-child(3)]:ml-0 xl:[&>*:nth-child(3)]:border-t xl:[&>*:nth-child(3)]:pt-2"
          : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-[family-name:var(--font-plan-mono)] text-lg font-bold leading-none tabular-nums text-[#1F2410]">
          {distanceText}
        </span>
        <span className="font-[family-name:var(--font-plan-mono)] text-[12px] font-semibold tabular-nums text-[#5C6450]">
          {timeText}
        </span>
      </div>
      <div className="flex items-center gap-3 font-[family-name:var(--font-plan-mono)] text-[12px] font-semibold tabular-nums">
        <span className="inline-flex items-center gap-1 text-[#2D5016]" title="D+">
          <SummitIcon size={15} strokeWidth={2} />
          {elevationNumber(elevationGainText)}
        </span>
        <span className="inline-flex items-center gap-1 text-[#3F6F8F]" title="D-">
          <DescentIcon size={15} strokeWidth={2} />
          {elevationNumber(elevationLossText)}
        </span>
      </div>
      {paceControl ? (
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-[#E5E2D8] pt-2">
          <PaceIcon size={16} strokeWidth={2} className="shrink-0 text-[#8A917E]" />
          {paceControl}
        </div>
      ) : null}
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
  /** The helper is a shortfall warning (e.g. the water bag is too small), not a neutral note. */
  helperIsWarning?: boolean;
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

/** Plan palette (design-system tokens) for the « bande cible » gauges and the course rail. */
const planTone = {
  success: { text: "text-[#2D5016]", fill: "#2D5016", pill: "bg-[#E8F0E0] text-[#2D5016]" },
  warning: { text: "text-[#B45309]", fill: "#F0873A", pill: "bg-[#FEF3C7] text-[#B45309]" },
  danger: { text: "text-[#C0392B]", fill: "#C0392B", pill: "bg-[#FDECEA] text-[#C0392B]" },
  neutral: { text: "text-[#1F2410]", fill: "#5C6450", pill: "bg-[#EAE8E1] text-[#5C6450]" },
} as const;

/** « 180 g de glucides » → « 180 g »: the gauge already names the nutrient. */
const stripNutrientSuffix = (value: string) => value.split(" de ")[0].split(" d'")[0].split(" of ")[0];

/**
 * « Bande cible » gauge: a quiet sand track, the target zone in olive, a fill bar up to the planned amount
 * (forest when on target, amber/red when off) and a tick on the exact target. The status is written out
 * (« Il manque 77 g ») instead of being encoded in a traffic-light gradient.
 */
function NutritionCard({ metric, variant = "default", waterCapacityMl, targetLabel }: NutritionCardProps) {
  const isCompact = variant === "compact";
  const targetValue = Math.max(metric.targetValue, 0);
  const maxValueCandidate =
    metric.key === "water" && typeof waterCapacityMl === "number" && waterCapacityMl > 0
      ? waterCapacityMl
      : targetValue;
  const maxValue = Math.max(maxValueCandidate, targetValue * 1.2 || 1);
  const ranges = buildGaugeRanges(targetValue, maxValue);
  const scaleMax = Math.max(ranges.gaugeMax, metric.plannedValue * 1.05, 1);
  const fillPercent = clampNumber((metric.plannedValue / scaleMax) * 100, 0, 100);
  const targetPercent = clampNumber((targetValue / scaleMax) * 100, 0, 100);
  const zoneStartPercent = clampNumber((ranges.greenStart / scaleMax) * 100, 0, 100);
  const zoneEndPercent = clampNumber((ranges.greenEnd / scaleMax) * 100, 0, 100);
  const tone = planTone[metric.statusTone];
  const delta = metric.plannedValue - targetValue;
  const deltaText = stripNutrientSuffix(metric.format(Math.abs(delta)));
  const statusText =
    metric.statusTone === "success" || metric.statusTone === "neutral" || targetValue <= 0
      ? metric.statusLabel
      : delta < 0
        ? `${metric.statusLabel} · −${deltaText}`
        : `${metric.statusLabel} · +${deltaText}`;
  const isCapacityWarning = metric.helperIsWarning === true;

  return (
    <div className={`flex min-w-0 flex-col rounded-[10px] bg-[#FAF8F2] ring-1 ring-[#E5E2D8] ${isCompact ? "gap-2 p-3" : "gap-3 p-4"}`}>
      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#1F2410]">
        <span className="shrink-0 text-[#2D5016]">{metric.icon}</span>
        <span className="truncate">{metric.name}</span>
      </span>
      <p className="flex items-baseline gap-1.5 font-[family-name:var(--font-plan-mono)] tabular-nums">
        <span className={`${isCompact ? "text-[22px]" : "text-3xl"} font-bold leading-none tracking-tight ${tone.text}`}>
          {stripNutrientSuffix(metric.value)}
        </span>
        <span className="text-[11px] font-medium text-[#8A917E]">
          / {stripNutrientSuffix(metric.format(targetValue))}
        </span>
      </p>
      <div
        className="relative h-2 w-full rounded-full bg-[#EAE8E1]"
        role="meter"
        aria-label={`${metric.name} : ${stripNutrientSuffix(metric.value)}, ${targetLabel.toLowerCase()} ${stripNutrientSuffix(metric.format(targetValue))}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(scaleMax)}
        aria-valuenow={Math.round(metric.plannedValue)}
      >
        <span
          className="absolute inset-y-0 rounded-full bg-[#C8D44E]/70"
          style={{ left: `${zoneStartPercent}%`, width: `${Math.max(zoneEndPercent - zoneStartPercent, 2)}%` }}
          aria-hidden
        />
        <span
          className="absolute inset-y-[2px] left-[2px] rounded-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `max(calc(${fillPercent}% - 4px), 0px)`, backgroundColor: tone.fill }}
          aria-hidden
        />
        <span
          className="absolute -inset-y-1 w-[2px] -translate-x-1/2 rounded-full bg-[#1F2410]"
          style={{ left: `${targetPercent}%` }}
          aria-hidden
        />
      </div>
      <p className={`inline-flex w-fit max-w-full rounded-full px-2 py-0.5 text-[11px] font-semibold leading-snug ${tone.pill}`}>
        {statusText}
      </p>
      {metric.helper ? (
        <p className={`text-[11px] leading-snug ${isCapacityWarning ? "font-semibold text-[#B45309]" : "text-[#8A917E]"}`}>
          {metric.helper}
        </p>
      ) : null}
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

type AidStationHeaderProps = {
  pointIndex: number;
  badge?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  onTitleClick?: () => void;
};

/**
 * One point of the course on the dotted trail rail: the marker sits on the rail (left column), the station
 * card and the section that follows it sit in the content column.
 */
function RailItem({ marker, children }: { marker?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-2.5 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-x-4">
      <div className="relative z-10 flex items-start justify-center pt-3">
        {marker ? <div className="origin-top scale-[0.9] sm:scale-100">{marker}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AidStationHeader({ title, meta, onTitleClick }: AidStationHeaderProps) {
  return (
    <div
      className={`flex min-w-0 items-start gap-3 sm:min-w-[220px] ${onTitleClick ? "cursor-pointer" : ""}`}
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
      <div className="min-w-0 space-y-1.5">
        <div className="font-[family-name:var(--font-plan-display)] text-lg font-semibold leading-tight tracking-tight text-[#1F2410] sm:text-xl">
          <span className={onTitleClick ? "decoration-[#B5CC9A] decoration-2 underline-offset-4 hover:underline" : undefined}>{title}</span>
        </div>
        {meta ? <div className="text-xs font-normal text-[#5C6450]">{meta}</div> : null}
      </div>
    </div>
  );
}

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
    <div className="relative z-20 rounded-2xl bg-white px-4 py-4 ring-1 ring-[#E5E2D8] shadow-[0_1px_0_rgba(31,36,16,0.04),0_12px_28px_-18px_rgba(45,80,22,0.35)] sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <AidStationHeader
          pointIndex={pointIndex}
          badge={badge}
          title={title}
          meta={meta}
          onTitleClick={onTitleClick}
        />
        {headerActions ? <div className="flex shrink-0 items-center justify-end gap-1.5">{headerActions}</div> : null}
      </div>
      {headerMiddle ? <div className="mt-3 flex w-full min-w-0">{headerMiddle}</div> : null}
      {isFinish ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-[#F4F2EC] px-3 py-2 text-sm text-[#5C6450]">
          <span>{finishLabel ?? "Arrivée"}</span>
        </div>
      ) : null}
    </div>
  );
}

type EmbarkedSummaryItem = {
  key: string;
  label: string;
  value: string;
  dotClassName: string;
};

type SubSectionRowProps = {
  label: string;
  distanceKm: number;
  elevationGainM?: number | null;
  elevationLossM?: number | null;
  etaMinutes: number;
  etaLabel: string;
  formatDistance: (value: number) => string;
  formatMinutes: (value: number) => string;
  elevationProfile: ElevationPoint[];
  startDistanceKm: number;
  endDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
  deleteLabel?: string;
  editLabel?: string;
  paceControl?: ReactNode;
  segmentIndex?: number;
  onDelete?: (segmentIndex: number) => void;
  onEdit?: (segmentIndex: number) => void;
};

function SubSectionRow({
  label,
  distanceKm,
  elevationGainM,
  elevationLossM,
  etaMinutes,
  etaLabel,
  formatDistance,
  formatMinutes,
  elevationProfile,
  startDistanceKm,
  endDistanceKm,
  copy,
  baseMinutesPerKm,
  deleteLabel,
  editLabel,
  paceControl,
  segmentIndex,
  onDelete,
  onEdit,
}: SubSectionRowProps) {
  const canDelete = onDelete && typeof segmentIndex === "number";
  const canEdit = onEdit && typeof segmentIndex === "number";
  const handleDelete = useCallback(() => {
    if (!canDelete) return;
    const confirmMessage = deleteLabel ? `${deleteLabel}?` : "Supprimer ce segment ?";
    if (!window.confirm(confirmMessage)) {
      return;
    }
    onDelete(segmentIndex as number);
  }, [canDelete, deleteLabel, onDelete, segmentIndex]);
  const handleEdit = useCallback(() => {
    if (!canEdit) return;
    onEdit(segmentIndex as number);
  }, [canEdit, onEdit, segmentIndex]);

  return (
    <Card className="border-border/40 bg-muted/40 shadow-sm dark:bg-slate-900/40">
      <CardContent className="grid gap-4 p-3 text-sm text-foreground md:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground dark:text-slate-50">{label}</p>
            <div className="flex items-center gap-2">
              {canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 rounded-full border border-border bg-background p-0 text-foreground shadow-sm hover:bg-muted dark:bg-slate-950/60 dark:text-slate-100 dark:hover:bg-slate-800/60"
                  onClick={handleEdit}
                  aria-label={editLabel ? `${editLabel} ${label}` : undefined}
                  title={editLabel ? `${editLabel} ${label}` : undefined}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 rounded-full border border-rose-200 bg-rose-50 p-0 text-rose-700 shadow-sm hover:bg-rose-100 hover:text-rose-800 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-100 dark:hover:bg-rose-500/20"
                  onClick={handleDelete}
                  aria-label={deleteLabel ? `${deleteLabel} ${label}` : undefined}
                  title={deleteLabel ? `${deleteLabel} ${label}` : undefined}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              ) : null}
            </div>
          </div>
          <SegmentCard
            variant="compact"
            distanceText={formatDistance(distanceKm)}
            timeText={`${etaLabel}: ${formatMinutes(etaMinutes)}`}
            elevationGainText={`D+ ${Math.round(elevationGainM ?? 0)}`}
            elevationLossText={`D- ${Math.round(elevationLossM ?? 0)}`}
            paceControl={paceControl}
          />
        </div>
        <div className="rounded-lg border border-border bg-background p-2 shadow-sm dark:bg-slate-950/70">
          <SubSectionElevationChart
            elevationProfile={elevationProfile}
            startDistanceKm={startDistanceKm}
            endDistanceKm={endDistanceKm}
            copy={copy}
            baseMinutesPerKm={baseMinutesPerKm}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type EmbarkedSummaryBoxProps = {
  items: EmbarkedSummaryItem[];
};

function EmbarkedSummaryBox({ items }: EmbarkedSummaryBoxProps) {
  return (
    <div className="w-full rounded-[10px] bg-[#F4F2EC] px-3 py-2 md:max-w-[280px]">
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-2 text-xs text-[#1F2410]">
            <span className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${item.dotClassName}`} />
              <span className="text-[#5C6450]">{item.label}</span>
            </span>
            <span className="font-[family-name:var(--font-plan-mono)] font-semibold tabular-nums">{item.value}</span>
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

function PaceStepButton({
  children,
  onClick,
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const handlePointerDown = () => {
    if (disabled) return;
    onClick();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onClick, 80);
    }, 400);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      className={className}
      disabled={disabled}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerUp={clear}
      onPointerLeave={clear}
    >
      {children}
    </Button>
  );
}

type BetweenAidStationSectionProps = {
  sectionSummary: ReactNode;
  nutritionCards: ReactNode[];
  toggleButton?: ReactNode;
  subSections?: ReactNode;
  subSectionActions?: ReactNode;
  showSubSections?: boolean;
};

function BetweenAidStationSection({
  sectionSummary,
  nutritionCards,
  toggleButton,
  subSections,
  subSectionActions,
  showSubSections,
}: BetweenAidStationSectionProps) {
  return (
    <div className="relative mt-2">
      <div className="rounded-2xl bg-[#F4F2EC] p-3 ring-1 ring-inset ring-[#E5E2D8]/70 sm:p-4">
        <div className="grid gap-2.5 xl:grid-cols-[200px_minmax(0,1fr)] xl:items-stretch">
          <div className="min-w-0">{sectionSummary}</div>
          {nutritionCards.length > 0 ? (
            <div className="grid min-w-0 gap-2.5 sm:grid-cols-3">{nutritionCards}</div>
          ) : null}
        </div>
        {toggleButton ? <div className="mt-3 flex flex-wrap items-center gap-2">{toggleButton}</div> : null}
        {showSubSections ? (
          <div className="mt-3 space-y-3">
            <div className="relative space-y-2 pl-6 before:absolute before:left-2 before:top-0 before:bottom-0 before:border-l-2 before:border-dotted before:border-[#B5CC9A]">
              {subSections}
            </div>
            {subSectionActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-[#E5E2D8] shadow-[0_1px_0_rgba(31,36,16,0.04)]">
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <div className="min-w-0 flex-1 space-y-0.5 md:order-1">
          <div className="truncate font-[family-name:var(--font-plan-display)] text-base font-semibold text-[#1F2410]">{title}</div>
          <div className="truncate font-[family-name:var(--font-plan-mono)] text-[12px] tabular-nums text-[#5C6450]">{metaLine}</div>
          {pauseLine ? <div className="truncate text-[11px] text-[#8A917E]">{pauseLine}</div> : null}
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

type ProductDetailModalProps = {
  product: FuelProduct | null;
  locale: "en" | "fr";
  onClose: () => void;
};

const productDetailCopy = {
  fr: {
    title: "Détail du produit",
    close: "Fermer",
    officialSite: "Acheter ce produit",
    notAvailable: "Non renseigné",
    perServing: "Valeurs par unité / portion",
    brand: "Marque",
    type: "Type",
    carbs: "Glucides",
    sodium: "Sodium",
    calories: "Calories",
    protein: "Protéines",
    fat: "Lipides",
    water: "Eau",
  },
  en: {
    title: "Product details",
    close: "Close",
    officialSite: "Buy this product",
    notAvailable: "Not provided",
    perServing: "Values per unit / serving",
    brand: "Brand",
    type: "Type",
    carbs: "Carbs",
    sodium: "Sodium",
    calories: "Calories",
    protein: "Protein",
    fat: "Fat",
    water: "Water",
  },
};

const formatOptionalText = (value: string | null | undefined, fallback: string) =>
  value && value.trim() ? value : fallback;

const pickerOtherBrandLabel = {
  fr: "Autres marques",
  en: "Other brands",
};

const inferPickerBrand = (product: FuelProduct, locale: "en" | "fr") => {
  const explicitBrand = product.brand?.trim();
  if (explicitBrand) return explicitBrand;

  const firstToken = product.name
    .split(/\s+/)
    .map((part) => part.replace(/^[^A-Za-z0-9À-ÿ]+|[^A-Za-z0-9À-ÿ]+$/g, ""))
    .find(Boolean);

  return firstToken && firstToken.length > 2 ? firstToken : pickerOtherBrandLabel[locale];
};

const groupPickerProductsByBrand = (products: FuelProduct[], locale: "en" | "fr") => {
  const groups = products.reduce((map, product) => {
    const brand = inferPickerBrand(product, locale);
    const current = map.get(brand) ?? [];
    current.push(product);
    map.set(brand, current);
    return map;
  }, new Map<string, FuelProduct[]>());

  return Array.from(groups.entries())
    .map(([brand, items]) => ({ brand, items }))
    .sort((left, right) => left.brand.localeCompare(right.brand, locale, { sensitivity: "base" }));
};

function ProductDetailModal({ product, locale, onClose }: ProductDetailModalProps) {
  const copy = productDetailCopy[locale];

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, product]);

  if (!product) return null;

  const isVerified = isVerifiedProduct(product);
  const detailItems = [
    { label: copy.brand, value: formatOptionalText(product.brand, copy.notAvailable) },
    { label: copy.type, value: getFuelTypeLabel(product.fuelType, locale) },
  ];
  const nutritionItems = [
    { label: copy.carbs, value: `${product.carbsGrams} g` },
    { label: copy.sodium, value: `${product.sodiumMg} mg` },
    { label: copy.calories, value: `${product.caloriesKcal} kcal` },
    { label: copy.protein, value: `${product.proteinGrams} g` },
    { label: copy.fat, value: `${product.fatGrams} g` },
    { label: copy.water, value: typeof product.waterMl === "number" ? `${product.waterMl} ml` : copy.notAvailable },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={copy.close}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-border-strong bg-card shadow-2xl dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-300">
              {copy.title}
            </p>
            <h2 id="product-detail-title" className="mt-1 text-xl font-semibold text-foreground dark:text-slate-50">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">{copy.perServing}</p>
          </div>
          <Button variant="ghost" className="h-8 px-2" onClick={onClose}>
            ×
          </Button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[160px_1fr]">
          <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background dark:bg-slate-900">
            {isVerified ? (
              <VerifiedProductBadge
                locale={locale}
                className="absolute right-2 top-2 z-10 h-7 w-7"
              />
            ) : null}
            {product.imageUrl ? (
              <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-3" />
            ) : (
              <span className="text-xs text-muted-foreground">{copy.notAvailable}</span>
            )}
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {detailItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-border bg-background p-3 dark:bg-slate-900/70">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-foreground dark:text-slate-50">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {nutritionItems.map((item) => (
                <div key={item.label} className="rounded-xl border border-brand-border bg-brand-surface p-3 dark:border-emerald-400/20 dark:bg-emerald-500/5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground dark:text-slate-50">{item.value}</p>
                </div>
              ))}
            </div>
            {product.productUrl ? (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600 dark:focus-visible:outline-emerald-400"
              >
                {copy.officialSite}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ActionPlan({
  copy,
  segments,
  sectionSegments,
  elevationProfile,
  baseMinutesPerKm,
  fatigueLevel,
  raceTotals,
  sectionId,
  onPrintAssistance,
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
  localProductIds,
  organizerAidStationProducts,
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
  sampleMode,
}: ActionPlanProps) {
  const { locale } = useI18n();
  const [collapsedAidStations, setCollapsedAidStations] = useState<Record<string, boolean>>({});
  const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});
  const [isFinishDetailsOpen, setIsFinishDetailsOpen] = useState(false);
  const finishDetailsId = useId();
  const [segmentModalState, setSegmentModalState] = useState<
    | null
    | {
        type: "auto";
        aidStationIndex?: number | null;
        sectionIndex: number;
        startDistanceKm: number;
        endDistanceKm: number;
        title: string;
      }
    | {
        type: "marker";
        aidStationIndex?: number | null;
        sectionIndex: number;
        startDistanceKm: number;
        endDistanceKm: number;
        title: string;
      }
    | {
        type: "edit";
        sectionIndex: number;
        segmentIndex: number;
        totalKm: number;
        segmentKm: number;
        label: string;
        title: string;
      }
  >(null);
  const [editorState, setEditorState] = useState<
    | null
    | {
        mode: "edit";
        index: number;
        name: string;
        distance: string;
        pauseMinutes: string;
        maxStopMinutes?: number;
        waterRefill: boolean;
        solidRefill: boolean;
        assistanceAllowed: boolean;
      }
    | {
        mode: "create";
        name: string;
        distance: string;
        pauseMinutes: string;
        maxStopMinutes?: number;
        waterRefill: boolean;
        solidRefill: boolean;
        assistanceAllowed: boolean;
      }
  >(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [supplyPicker, setSupplyPicker] = useState<{ type: "start" | "aid"; index?: number } | null>(null);
  const [useOrganizerProductsForAutoFill, setUseOrganizerProductsForAutoFill] = useState(false);
  const [, startUiTransition] = useTransition();
  const [pickerFavorites, setPickerFavorites] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFuelType, setPickerFuelType] = useState<FuelType | "all">("all");
  const [pickerShowMyProducts, setPickerShowMyProducts] = useState(false);
  const [productDetail, setProductDetail] = useState<FuelProduct | null>(null);
  const [pickerSort, setPickerSort] = useState<{
    key: "name" | "type" | "carbs" | "sodium" | "calories" | "favorite";
    dir: "asc" | "desc";
  }>({
    key: "favorite",
    dir: "desc",
  });
  const timelineCopy = copy.sections.timeline;
  const aidStationsCopy = copy.sections.aidStations;
  const segmentCopy = copy.segments;
  const autoFillTooltipId = "timeline-auto-fill-tooltip";
  const sortedElevationProfile = useMemo(
    () => [...elevationProfile].sort((a, b) => a.distanceKm - b.distanceKm),
    [elevationProfile]
  );
  const paceModel = useMemo(
    () =>
      typeof baseMinutesPerKm === "number" && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
        ? {
            secondsPerKm: baseMinutesPerKm * 60,
            estimateSeconds: ({
              distKm,
              dPlus,
              dMinus,
              elapsedBeforeSeconds,
            }: {
              distKm: number;
              dPlus: number;
              dMinus: number;
              elapsedBeforeSeconds?: number;
            }) =>
              estimateEffortDurationSeconds(baseMinutesPerKm * 60, {
                distKm,
                dPlus,
                dMinus,
                elapsedBeforeSeconds,
                fatigueLevel,
              }),
          }
        : undefined,
    [baseMinutesPerKm, fatigueLevel]
  );
  const renderPaceAdjustmentControl = useCallback(
    ({
      basePaceMinutesPerKm,
      paceAdjustmentMinutesPerKm,
      fieldName,
      isDisabled,
      tooltip,
    }: {
      basePaceMinutesPerKm: number;
      paceAdjustmentMinutesPerKm?: number;
      fieldName: Path<FormValues> | null;
      isDisabled: boolean;
      tooltip?: string;
    }) => {
      if (!fieldName) return null;
      const adjustmentStep = 5 / 60;
      const paceMinutesPerKm = basePaceMinutesPerKm + (paceAdjustmentMinutesPerKm ?? 0);
      const adjust = (delta: number) => {
        const nextPace = Number((paceMinutesPerKm + delta).toFixed(4));
        const nextValue = Number((nextPace - basePaceMinutesPerKm).toFixed(4));
        setValue(fieldName, nextValue, { shouldDirty: true, shouldTouch: true });
      };
      return (
        <div
          className="inline-flex items-center gap-0.5 rounded-full bg-[#F4F2EC] p-0.5 ring-1 ring-[#E5E2D8]"
          title={tooltip}
        >
          <input
            type="hidden"
            {...register(fieldName, {
              setValueAs: parseOptionalNumber,
            })}
          />
          <PaceStepButton
            className="!min-h-0 h-7 w-7 rounded-full px-0 text-base !text-[#5C6450] hover:!bg-white hover:!text-[#2D5016] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => adjust(-adjustmentStep)}
            disabled={isDisabled}
            title={tooltip}
          >
            –
          </PaceStepButton>
          <span className="min-w-[4.5rem] px-1 text-center font-[family-name:var(--font-plan-mono)] text-[13px] font-bold tabular-nums text-[#1F2410]">
            {formatPaceValue(paceMinutesPerKm)}/km
          </span>
          <PaceStepButton
            className="!min-h-0 h-7 w-7 rounded-full px-0 text-base !text-[#5C6450] hover:!bg-white hover:!text-[#2D5016] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => adjust(adjustmentStep)}
            disabled={isDisabled}
            title={tooltip}
          >
            +
          </PaceStepButton>
        </div>
      );
    },
    [register, setValue]
  );
  const openCreateEditor = () =>
    setEditorState({
      mode: "create",
      name: copy.defaults.aidStationName,
      distance: "0",
      pauseMinutes: "",
      waterRefill: true,
      solidRefill: true,
      assistanceAllowed: true,
    });
  const updateEditorField = useCallback((field: "name" | "distance" | "pauseMinutes", value: string) => {
    setEditorState((current) => (current ? { ...current, [field]: value } : current));
    setEditorError(null);
  }, []);
  const updateEditorService = useCallback((field: "waterRefill" | "solidRefill" | "assistanceAllowed", value: boolean) => {
    setEditorState((current) => (current ? { ...current, [field]: value } : current));
    setEditorError(null);
  }, []);
  const productBySlug = useMemo(() => Object.fromEntries(fuelProducts.map((product) => [product.slug, product])), [fuelProducts]);
  const organizerProductIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(organizerAidStationProducts ?? {})
      .flat()
      .forEach((suggestion) => {
        if (suggestion.product?.id) ids.add(suggestion.product.id);
      });
    return ids;
  }, [organizerAidStationProducts]);
  const organizerSuggestionsByAidStationIndex = useMemo(() => {
    const map = new Map<number, OrganizerAidStationProductSuggestion[]>();
    segments.forEach((segment) => {
      if (typeof segment.aidStationIndex !== "number" || segment.isFinish) return;
      const suggestions = getOrganizerSuggestionsForAidStation(organizerAidStationProducts, {
        name: segment.checkpoint,
        distanceKm: segment.distanceKm,
        sourceAidStationId: segment.sourceAidStationId,
      });
      if (suggestions.length > 0) map.set(segment.aidStationIndex, suggestions);
    });
    return map;
  }, [organizerAidStationProducts, segments]);
  const hasOrganizerAidStationProducts = organizerProductIds.size > 0;
  const supplyPickerOrganizerSuggestions = useMemo(() => {
    if (!supplyPicker || supplyPicker.type !== "aid" || typeof supplyPicker.index !== "number") return [];
    return organizerSuggestionsByAidStationIndex.get(supplyPicker.index) ?? [];
  }, [organizerSuggestionsByAidStationIndex, supplyPicker]);
  const supplyPickerOrganizerProductIds = useMemo(
    () => new Set(supplyPickerOrganizerSuggestions.map((suggestion) => suggestion.product.id)),
    [supplyPickerOrganizerSuggestions]
  );
  const supplyPickerAllowsPersonalProducts = useMemo(() => {
    if (!supplyPicker || supplyPicker.type === "start") return true;
    if (typeof supplyPicker.index !== "number") return true;
    return segments.find((segment) => segment.aidStationIndex === supplyPicker.index)?.assistanceAllowed !== false;
  }, [segments, supplyPicker]);
  const pickerFavoriteSet = useMemo(() => new Set(pickerFavorites), [pickerFavorites]);
  const sectionSegmentsMap = useMemo(() => sectionSegments ?? {}, [sectionSegments]);
  const buildSectionSamples = useCallback(
    (startKm: number, endKm: number) => getElevationSlice(sortedElevationProfile, startKm, endKm),
    [sortedElevationProfile]
  );
  const normalizeSectionSegments = useCallback((segmentsToNormalize: SectionSegment[], totalKm: number) => {
    if (!segmentsToNormalize.length) return [];
    const sanitized = segmentsToNormalize
      .map((segment) => ({
        ...segment,
        segmentKm: Math.max(0, Number(segment.segmentKm.toFixed(3))),
      }))
      .filter((segment) => segment.segmentKm > 0);
    if (sanitized.length === 0) return [];
    if (!Number.isFinite(totalKm) || totalKm <= 0) return sanitized;
    const currentTotal = sanitized.reduce((sum, segment) => sum + segment.segmentKm, 0);
    const delta = Number((totalKm - currentTotal).toFixed(3));
    if (Math.abs(delta) < 0.01) return sanitized;
    const lastIndex = sanitized.length - 1;
    const lastSegment = sanitized[lastIndex];
    const adjustedKm = Math.max(0.01, Number((lastSegment.segmentKm + delta).toFixed(3)));
    sanitized[lastIndex] = { ...lastSegment, segmentKm: adjustedKm };
    return sanitized;
  }, []);
  const updateSectionSegments = useCallback(
    (sectionIndex: number, segmentsToUpdate?: SectionSegment[] | null) => {
      const sectionKey = buildSectionKey(sectionIndex);
      const nextSections = { ...sectionSegmentsMap };

      if (!segmentsToUpdate || segmentsToUpdate.length === 0) {
        delete nextSections[sectionKey];
      } else {
        nextSections[sectionKey] = segmentsToUpdate;
      }

      setValue("sectionSegments", nextSections, { shouldDirty: true, shouldValidate: true });
      setValue("segments", nextSections, { shouldDirty: true, shouldValidate: true });
    },
    [sectionSegmentsMap, setValue]
  );
  const handleDeleteSubSection = useCallback(
    (sectionIndex: number, segmentIndex: number) => {
      const sectionKey = buildSectionKey(sectionIndex);
      const storedSegments = sectionSegmentsMap[sectionKey] ?? [];
      const nextSegments = storedSegments.filter((_, index) => index !== segmentIndex);
      updateSectionSegments(sectionIndex, nextSegments.length ? nextSegments : null);
    },
    [sectionSegmentsMap, updateSectionSegments]
  );
  const buildGranularitySegments = useCallback((totalKm: number, granularityKm: number) => {
    if (!Number.isFinite(totalKm) || totalKm <= 0) return [];
    const safeGranularity = Number.isFinite(granularityKm) && granularityKm > 0 ? granularityKm : totalKm;
    const segments: SectionSegment[] = [];
    let remaining = totalKm;
    while (remaining > 0) {
      const segmentKm = Math.min(safeGranularity, remaining);
      segments.push({ segmentKm: Number(segmentKm.toFixed(3)) });
      remaining = Number((remaining - segmentKm).toFixed(3));
      if (segments.length > 500) break;
    }
    return segments;
  }, []);
  const splitSectionSegments = useCallback(
    (segmentsToSplit: SectionSegment[], splitKm: number, label?: string) => {
      if (segmentsToSplit.length === 0) return [];
      if (!Number.isFinite(splitKm) || splitKm <= 0) return segmentsToSplit;
      const totalKm = segmentsToSplit.reduce((sum, segment) => sum + segment.segmentKm, 0);
      if (splitKm >= totalKm) return segmentsToSplit;

      let remaining = splitKm;
      const result: SectionSegment[] = [];

      segmentsToSplit.forEach((segment, index) => {
        if (remaining <= 0) {
          result.push(segment);
          return;
        }

        if (remaining < segment.segmentKm) {
          const firstKm = Number(remaining.toFixed(3));
          const secondKm = Number((segment.segmentKm - firstKm).toFixed(3));
          if (firstKm > 0) {
            result.push({ ...segment, segmentKm: firstKm });
          }
          if (secondKm > 0) {
            result.push({
              ...segment,
              segmentKm: secondKm,
              ...(label ? { label } : {}),
            });
          }
          remaining = 0;
          return;
        }

        result.push(segment);
        remaining = Number((remaining - segment.segmentKm).toFixed(3));
        if (remaining === 0 && index < segmentsToSplit.length - 1) {
          return;
        }
      });

      return result;
    },
    []
  );
  const handleAutoSegmentConfirm = useCallback(
    (granularityKm: number) => {
      if (!segmentModalState || segmentModalState.type !== "auto") return;
      const totalKm = Math.max(0, segmentModalState.endDistanceKm - segmentModalState.startDistanceKm);
      if (!Number.isFinite(totalKm) || totalKm <= 0) {
        setSegmentModalState(null);
        return;
      }

      const presetByGranularity: Record<number, SegmentPreset> = {
        1: "grossier",
        0.5: "moyen",
        0.25: "fin",
      };
      const preset = presetByGranularity[granularityKm] ?? "moyen";
      const samples = buildSectionSamples(segmentModalState.startDistanceKm, segmentModalState.endDistanceKm);
      const autoSegments =
        samples.length > 1 ? autoSegmentSection(samples, preset) : [];
      const fallbackSegments = autoSegments.length > 0 ? autoSegments : buildGranularitySegments(totalKm, granularityKm);
      const normalized = normalizeSectionSegments(fallbackSegments, totalKm);

      if (normalized.length > 0) {
        updateSectionSegments(segmentModalState.sectionIndex, normalized);
      }
      setSegmentModalState(null);
    },
    [
      buildGranularitySegments,
      buildSectionSamples,
      normalizeSectionSegments,
      segmentModalState,
      updateSectionSegments,
    ]
  );
  const handleAddMarkerConfirm = useCallback(
    (payload: { distanceKm: number; type: string; label: string }) => {
      if (!segmentModalState || segmentModalState.type !== "marker") return;
      const totalKm = Math.max(0, segmentModalState.endDistanceKm - segmentModalState.startDistanceKm);
      if (!Number.isFinite(totalKm) || totalKm <= 0) {
        setSegmentModalState(null);
        return;
      }

      const splitKm = clampNumber(payload.distanceKm, 0, totalKm);
      if (splitKm <= 0 || splitKm >= totalKm) {
        setSegmentModalState(null);
        return;
      }

      const sectionKey = buildSectionKey(segmentModalState.sectionIndex);
      const currentSegments = normalizeSectionSegments(
        sectionSegmentsMap[sectionKey] ?? [{ segmentKm: totalKm }],
        totalKm
      );
      const trimmedLabel = payload.label.trim();
      const markerLabel = trimmedLabel || payload.type || "custom";
      const updated = splitSectionSegments(currentSegments, splitKm, markerLabel);
      updateSectionSegments(segmentModalState.sectionIndex, normalizeSectionSegments(updated, totalKm));
      setSegmentModalState(null);
    },
    [
      normalizeSectionSegments,
      sectionSegmentsMap,
      segmentModalState,
      splitSectionSegments,
      updateSectionSegments,
    ]
  );
  const handleEditSubSectionConfirm = useCallback(
    (payload: { segmentKm: number; label: string }) => {
      if (!segmentModalState || segmentModalState.type !== "edit") return;
      const sectionKey = buildSectionKey(segmentModalState.sectionIndex);
      const currentSegments = sectionSegmentsMap[sectionKey];
      if (!currentSegments || !currentSegments[segmentModalState.segmentIndex]) {
        setSegmentModalState(null);
        return;
      }
      const clampedKm = clampNumber(payload.segmentKm, 0.01, segmentModalState.totalKm);
      const nextSegments = currentSegments.map((segment, index) =>
        index === segmentModalState.segmentIndex
          ? {
              ...segment,
              segmentKm: clampedKm,
              label: payload.label.trim() || undefined,
            }
          : segment
      );
      updateSectionSegments(
        segmentModalState.sectionIndex,
        normalizeSectionSegments(nextSegments, segmentModalState.totalKm)
      );
      setSegmentModalState(null);
    },
    [normalizeSectionSegments, sectionSegmentsMap, segmentModalState, updateSectionSegments]
  );
  useEffect(() => {
    setPickerFavorites(favoriteProducts.map((product) => product.slug));
  }, [favoriteProducts]);
  const supplyPickerProducts = useMemo(() => {
    const products = new Map<string, FuelProduct>();
    if (supplyPickerAllowsPersonalProducts) {
      fuelProducts.forEach((product) => {
        if (!organizerProductIds.has(product.id) || supplyPickerOrganizerProductIds.has(product.id)) {
          products.set(product.id, product);
        }
      });
    }
    supplyPickerOrganizerSuggestions.forEach((suggestion) => {
      products.set(suggestion.product.id, suggestion.product);
    });
    return Array.from(products.values());
  }, [
    fuelProducts,
    organizerProductIds,
    supplyPickerAllowsPersonalProducts,
    supplyPickerOrganizerProductIds,
    supplyPickerOrganizerSuggestions,
  ]);
  const filteredPickerProducts = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase();
    const localIds = new Set(localProductIds ?? []);
    return supplyPickerProducts.filter((product) => {
      const brand = inferPickerBrand(product, locale).toLowerCase();
      const matchesSearch =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.slug.toLowerCase().includes(term) ||
        brand.includes(term);
      const matchesType = pickerFuelType === "all" || product.fuelType === pickerFuelType;
      const matchesOwnership =
        !pickerShowMyProducts ||
        pickerFavoriteSet.has(product.slug) ||
        localIds.has(product.id) ||
        supplyPickerOrganizerProductIds.has(product.id);
      return matchesSearch && matchesType && matchesOwnership;
    });
  }, [
    localProductIds,
    locale,
    pickerFavoriteSet,
    pickerFuelType,
    pickerSearch,
    pickerShowMyProducts,
    supplyPickerOrganizerProductIds,
    supplyPickerProducts,
  ]);
  const sortedPickerProducts = useMemo(() => {
    return [...filteredPickerProducts].sort((a, b) => {
      const dir = pickerSort.dir === "asc" ? 1 : -1;
      if (pickerSort.key === "favorite") {
        const aFav = Number(pickerFavoriteSet.has(a.slug));
        const bFav = Number(pickerFavoriteSet.has(b.slug));
        if (aFav === bFav) return a.name.localeCompare(b.name, locale, { sensitivity: "base" });
        return pickerSort.dir === "asc" ? aFav - bFav : bFav - aFav;
      }
      if (pickerSort.key === "name") return a.name.localeCompare(b.name, locale, { sensitivity: "base" }) * dir;
      if (pickerSort.key === "type") return a.fuelType.localeCompare(b.fuelType, locale, { sensitivity: "base" }) * dir;
      if (pickerSort.key === "carbs") return (a.carbsGrams - b.carbsGrams) * dir;
      if (pickerSort.key === "sodium") return (a.sodiumMg - b.sodiumMg) * dir;
      return (a.caloriesKcal - b.caloriesKcal) * dir;
    });
  }, [filteredPickerProducts, locale, pickerFavoriteSet, pickerSort]);
  const groupedPickerProducts = useMemo(
    () => groupPickerProductsByBrand(sortedPickerProducts, locale),
    [locale, sortedPickerProducts]
  );
  const pickerTableRows = useMemo(
    () =>
      groupedPickerProducts.flatMap((group) => [
        { type: "group" as const, key: `group-${group.brand}`, brand: group.brand, count: group.items.length },
        ...group.items.map((product) => ({ type: "product" as const, key: product.slug, product })),
      ]),
    [groupedPickerProducts]
  );
  const {
    renderItems,
    collapsibleKeys,
    productById,
    finishSummary,
    sectionComputationByItemId,
    summarizedSuppliesByItemId,
    carryoverCoverageByItemId,
    aidSuppliesByStationIndex,
  } = useActionPlanDerivedData({
    segments,
    fuelProducts,
    startSupplies,
    raceDurationMinutes: raceTotals?.durationMinutes,
    sectionSegmentsMap,
    sortedElevationProfile,
    normalizeSectionSegments,
    paceModel,
  });
  const metricIcons = {
    carbs: <NutritionIcon size={17} strokeWidth={1.9} />,
    water: <HydrationIcon size={17} strokeWidth={1.9} color="#3F6F8F" />,
    sodium: <SaltIcon className="h-[17px] w-[17px]" />,
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
    startUiTransition(() => {
      setCollapsedAidStations((current) => ({
        ...current,
        [collapseKey]: !current[collapseKey],
      }));
    });
  };
  const hasCollapsibleAidStations = collapsibleKeys.length > 0;
  const areAllAidStationsCollapsed = hasCollapsibleAidStations
    ? collapsibleKeys.every((key) => collapsedAidStations[key])
    : false;
  const toggleAidStationsCollapseAll = () => {
    if (!hasCollapsibleAidStations) return;
    const nextValue = !areAllAidStationsCollapsed;
    startUiTransition(() => {
      setCollapsedAidStations((current) =>
        collapsibleKeys.reduce<Record<string, boolean>>((acc, key) => {
          acc[key] = nextValue;
          return acc;
        }, { ...current })
      );
    });
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
      setValue(`aidStations.${editorState.index}.waterRefill`, editorState.waterRefill);
      setValue(`aidStations.${editorState.index}.solidRefill`, editorState.solidRefill);
      setValue(`aidStations.${editorState.index}.assistanceAllowed`, editorState.assistanceAllowed);
      if (!editorState.assistanceAllowed) {
        const organizerSupplies = (aidSuppliesByStationIndex.get(editorState.index) ?? []).filter(
          (supply) => supply.source === "organizer"
        );
        setValue(`aidStations.${editorState.index}.supplies`, organizerSupplies);
      }
    } else {
      onAddAidStation({
        name,
        distanceKm: distanceValue,
        waterRefill: editorState.waterRefill,
        solidRefill: editorState.solidRefill,
        assistanceAllowed: editorState.assistanceAllowed,
      });
    }
    closeEditor();
  }, [
    aidSuppliesByStationIndex,
    closeEditor,
    copy.validation.nonNegative,
    copy.validation.required,
    editorState,
    onAddAidStation,
    setValue,
  ]);

  const getAidSupplies = useCallback(
    (aidStationIndex: number) => aidSuppliesByStationIndex.get(aidStationIndex) ?? [],
    [aidSuppliesByStationIndex]
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
          onSupplyDrop(supplyPicker.index, product.id, 1, {
            source: supplyPickerOrganizerProductIds.has(product.id) ? "organizer" : undefined,
          });
        }
      }
    },
    [
      onStartSupplyDrop,
      onStartSupplyRemove,
      onSupplyDrop,
      onSupplyRemove,
      productBySlug,
      supplyPicker,
      supplyPickerOrganizerProductIds,
      supplyPickerSelectedSlugs,
    ]
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
      <Card
        id={sectionId}
        className={`${planFontVariables} rounded-3xl border-0 bg-[#FAF8F2] shadow-none ring-1 ring-[#E5E2D8]`}
      >
        <CardHeader className="space-y-3">
          <SectionHeader
            title={timelineCopy.title}
            description={timelineCopy.description}
            descriptionAsTooltip
          action={
            <div className="flex flex-wrap items-center gap-2">
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
              <span id="onboarding-add-aid-btn" className="inline-flex">
                <Button type="button" onClick={sampleMode ? sampleMode.onLockedAction : openCreateEditor}>
                  {aidStationsCopy.add}
                </Button>
              </span>
              {segments.length > 0 && hasOrganizerAidStationProducts ? (
                <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground dark:bg-slate-900/70 dark:text-slate-100">
                  <input
                    type="checkbox"
                    checked={useOrganizerProductsForAutoFill}
                    onChange={(event) => setUseOrganizerProductsForAutoFill(event.target.checked)}
                    className="h-4 w-4 rounded border-border bg-background text-emerald-500 focus:ring-ring dark:bg-slate-900"
                  />
                  <span>{locale === "fr" ? "Produits ravito" : "Aid products"}</span>
                </label>
              ) : null}
              {segments.length > 0 ? (
                <span className="group relative inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    className={autoFillLocked ? "premium-glow" : undefined}
                    onClick={
                      sampleMode
                        ? sampleMode.onLockedAction
                        : autoFillLocked
                        ? () => onUpgrade("autoFill")
                        : () => onAutomaticFill({ useOrganizerProducts: useOrganizerProductsForAutoFill })
                    }
                    aria-describedby={autoFillTooltipId}
                    disabled={autoFillLocked && isUpgradeBusy}
                  >
                    {copy.buttons.autoFill}
                  </Button>
                  <span
                    id={autoFillTooltipId}
                    role="tooltip"
                    className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs leading-snug text-popover-foreground opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {copy.buttons.autoFillHint}
                  </span>
                </span>
              ) : null}
              {segments.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className={exportLocked ? "hidden sm:inline-flex premium-glow" : "hidden sm:inline-flex"}
                  onClick={sampleMode ? sampleMode.onLockedAction : exportLocked ? () => onUpgrade("print") : onPrintAssistance}
                  disabled={exportLocked && isUpgradeBusy}
                >
                  {copy.buttons.printPlan}
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
        {segments.length > 0 ? (
          <div className="relative space-y-6 before:pointer-events-none before:absolute before:bottom-10 before:left-[21px] before:top-8 before:border-l-[3px] before:border-dotted before:border-[#B5CC9A] sm:before:left-[23px]">
            {(() => {
              const renderedItems = renderItems.map((item, itemIndex) => {
                const pointNumber = itemIndex + 1;
                const distanceFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.distanceKm` as const)
                    : null;
                const waterRefillFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.waterRefill` as const)
                    : null;
                const solidRefillFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.solidRefill` as const)
                    : null;
                const assistanceAllowedFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.assistanceAllowed` as const)
                    : null;
                const pauseMinutesValue =
                  typeof item.checkpointSegment?.pauseMinutes === "number" ? item.checkpointSegment.pauseMinutes : 0;
                const metaText = `${formatDistanceWithUnit(item.distanceKm)} · ${timelineCopy.etaLabel}: ${formatMinutes(item.etaMinutes)}`;

                const nextSegment = item.upcomingSegment;
                const summarized = summarizedSuppliesByItemId.get(item.id) ?? null;
                const carryoverCoverage = carryoverCoverageByItemId.get(item.id) ?? null;
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
                const waterRefillAvailable = item.isStart || item.checkpointSegment?.waterRefill !== false;
                const solidRefillAvailable = item.isStart || item.checkpointSegment?.solidRefill !== false;
                const assistanceAvailable = item.isStart || item.checkpointSegment?.assistanceAllowed !== false;
                const serviceLabel = item.isStart
                  ? locale === "fr" ? "Stock initial" : "Initial stock"
                  : waterRefillAvailable && solidRefillAvailable
                    ? locale === "fr" ? "Eau + solide" : "Water + solid"
                    : waterRefillAvailable
                      ? locale === "fr" ? "Eau seulement" : "Water only"
                      : solidRefillAvailable
                        ? locale === "fr" ? "Solide seulement" : "Solid only"
                        : locale === "fr" ? "Aucun service" : "No service";
                const assistanceLabel = assistanceAvailable
                  ? locale === "fr" ? "Assistance" : "Crew access"
                  : locale === "fr" ? "Sans assistance" : "No crew access";
                const aidStationBadge = item.isStart ? (
                  <AidStationBadge step={pointNumber} variant="start" />
                ) : isAidStation ? (
                  <AidStationBadge step={pointNumber} variant="ravito" />
                ) : item.isFinish ? (
                  <AidStationBadge step={pointNumber} variant="finish" />
                ) : null;
                const organizerSuggestions =
                  isAidStation && typeof item.aidStationIndex === "number"
                    ? getOrganizerSuggestionsForAidStation(organizerAidStationProducts, {
                        name: item.title,
                        distanceKm: item.distanceKm,
                        sourceAidStationId: item.checkpointSegment?.sourceAidStationId,
                      })
                    : [];
                const selectedAidProductIds =
                  typeof item.aidStationIndex === "number"
                    ? new Set(getAidSupplies(item.aidStationIndex).map((supply) => supply.productId))
                    : new Set<string>();
                const organizerSuggestionsBlock =
                  organizerSuggestions.length > 0 && typeof item.aidStationIndex === "number" ? (
                    <div className="mt-3 rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-foreground dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-slate-50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
                            {locale === "fr" ? "Produits organisation" : "Organizer products"}
                          </p>
                          <p className="text-xs text-muted-foreground dark:text-slate-300">
                            {locale === "fr"
                              ? "Proposes pour ce ravito. L'auto-fill ne les utilise que si l'option Produits ravito est activee."
                              : "Suggested for this aid station. Auto-fill uses them only when Aid products is enabled."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {organizerSuggestions.map((suggestion) => {
                          const isSelected = selectedAidProductIds.has(suggestion.product.id);
                          return (
                            <button
                              key={`${suggestion.product.id}-${suggestion.orderIndex}`}
                              type="button"
                              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                                isSelected
                                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-800 dark:text-emerald-100"
                                  : "border-border bg-card text-foreground hover:border-emerald-400 dark:bg-slate-950/70 dark:text-slate-100"
                              }`}
                              onClick={() => {
                                if (typeof item.aidStationIndex !== "number") return;
                                if (isSelected) {
                                  onSupplyRemove(item.aidStationIndex, suggestion.product.id);
                                } else {
                                  onSupplyDrop(item.aidStationIndex, suggestion.product.id, 1, { source: "organizer" });
                                }
                              }}
                            >
                              <span className="block font-semibold">{suggestion.product.name}</span>
                              <span className="block text-muted-foreground dark:text-slate-300">
                                {getFuelTypeLabel(suggestion.product.fuelType, locale)} · {suggestion.product.carbsGrams} g · {suggestion.product.sodiumMg} mg
                              </span>
                              {suggestion.notes ? (
                                <span className="mt-1 block text-muted-foreground dark:text-slate-400">
                                  {suggestion.notes}
                                </span>
                              ) : null}
                              <span className="mt-1 block font-semibold">
                                {isSelected
                                  ? locale === "fr" ? "Selectionne" : "Selected"
                                  : locale === "fr" ? "Ajouter au ravito" : "Add to aid station"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null;
                const metaContent = (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-[#5C6450]">
                    <span className="rounded-[6px] bg-[#2D5016] px-1.5 py-0.5 font-[family-name:var(--font-plan-mono)] text-[11.5px] font-bold tabular-nums text-[#FAF8F2]">
                      km {formatKmPost(item.distanceKm, locale)}
                    </span>
                    {!item.isStart ? (
                      <span>
                        {locale === "fr" ? "Passage" : "Arrival"}{" "}
                        <span className="font-[family-name:var(--font-plan-mono)] font-semibold tabular-nums text-[#1F2410]">
                          {formatMinutes(item.etaMinutes)}
                        </span>
                      </span>
                    ) : null}
                    {pauseMinutesValue > 0 ? (
                      <span>
                        {locale === "fr" ? "Pause" : "Stop"}{" "}
                        <span className="font-[family-name:var(--font-plan-mono)] font-semibold tabular-nums text-[#1F2410]">{pauseMinutesValue} min</span>
                      </span>
                    ) : null}
                    {!item.isFinish ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F2EC] px-2 py-0.5 text-[11.5px] font-medium text-[#1F2410]">
                        {waterRefillAvailable && !item.isStart ? <HydrationIcon size={13} strokeWidth={2} color="#3F6F8F" /> : null}
                        {solidRefillAvailable && !item.isStart ? <NutritionIcon size={13} strokeWidth={2} /> : null}
                        {serviceLabel}
                      </span>
                    ) : null}
                    {!item.isFinish && !item.isStart ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
                          assistanceAvailable ? "bg-[#E8F0E0] text-[#2D5016]" : "bg-[#F4F2EC] text-[#8A917E]"
                        }`}
                      >
                        {assistanceLabel}
                      </span>
                    ) : null}
                  </div>
                );
                const toggleButton =
                  isCollapsible && collapseKey ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="!min-h-0 h-9 w-9 rounded-full px-0 !text-[#5C6450] hover:!bg-[#F4F2EC] hover:!text-[#1F2410]"
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
                    <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-2.5 text-[11.5px] font-medium text-[#5C6450] ring-1 ring-[#E5E2D8] has-[:checked]:bg-[#E8F0E0] has-[:checked]:text-[#2D5016] has-[:checked]:ring-[#B5CC9A]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-[#2D5016]"
                        {...register(waterRefillFieldName)}
                      />
                      <span>{aidStationsCopy.labels.waterRefill}</span>
                    </label>
                  ) : null;
                const solidRefillToggle =
                  distanceFieldName && !isCollapsed && solidRefillFieldName ? (
                    <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-2.5 text-[11.5px] font-medium text-[#5C6450] ring-1 ring-[#E5E2D8] has-[:checked]:bg-[#E8F0E0] has-[:checked]:text-[#2D5016] has-[:checked]:ring-[#B5CC9A]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-[#2D5016]"
                        {...register(solidRefillFieldName)}
                      />
                      <span>{aidStationsCopy.labels.solidRefill}</span>
                    </label>
                  ) : null;
                const assistanceAllowedToggle =
                  distanceFieldName && !isCollapsed && assistanceAllowedFieldName ? (
                    <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white px-2.5 text-[11.5px] font-medium text-[#5C6450] ring-1 ring-[#E5E2D8] has-[:checked]:bg-[#E8F0E0] has-[:checked]:text-[#2D5016] has-[:checked]:ring-[#B5CC9A]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded accent-[#2D5016]"
                        {...register(assistanceAllowedFieldName, {
                          onChange: (event) => {
                            if (!event.target.checked && typeof item.aidStationIndex === "number") {
                              const organizerSupplies = getAidSupplies(item.aidStationIndex).filter(
                                (supply) => supply.source === "organizer"
                              );
                              setValue(`aidStations.${item.aidStationIndex}.supplies`, organizerSupplies);
                            }
                          },
                        })}
                      />
                      <span>{locale === "fr" ? "Assistance" : "Crew access"}</span>
                    </label>
                  ) : null;
                const suppliesDropZone =
                  (item.isStart || (typeof item.aidStationIndex === "number" && assistanceAvailable)) && !isCollapsed ? (
                    <div
                      id={item.isStart ? "onboarding-start-supply-zone" : undefined}
                      className="flex w-full flex-1 flex-col gap-2 rounded-xl border border-dashed border-[#C9C5B8] bg-[#FAF8F2] p-2.5"
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
                      <p className="px-0.5 text-[12px] font-medium text-[#5C6450]">
                        {item.isStart
                          ? locale === "fr" ? "Dans ton sac au départ" : "In your pack at the start"
                          : locale === "fr" ? "À récupérer à ce ravito" : "To pick up at this aid station"}
                      </p>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                          {summarized?.items?.length
                            ? summarized.items.map(({ product, quantity }) => {
                                const supplySource =
                                  !item.isStart && typeof item.aidStationIndex === "number"
                                    ? getAidSupplies(item.aidStationIndex).find((supply) => supply.productId === product.id)?.source
                                    : undefined;
                                const supplyDropOptions = supplySource ? { source: supplySource } : undefined;
                                return (
                                <div
                                  key={product.id}
                                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-1 text-sm text-[#1F2410] ring-1 ring-[#E5E2D8]"
                                >
                                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#2D5016] px-1.5 font-[family-name:var(--font-plan-mono)] text-[11px] font-bold tabular-nums text-[#FAF8F2]">
                                    {quantity}
                                  </span>
                                  <button
                                    type="button"
                                    className="min-w-0 max-w-[14rem] truncate text-left font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5016]"
                                    onClick={() => setProductDetail(product)}
                                    aria-label={`${productDetailCopy[locale].title}: ${product.name} ×${quantity}`}
                                  >
                                    {product.name}
                                  </button>
                                  <div className="flex items-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!min-h-0 h-6 w-6 rounded-full px-0 !text-[#8A917E] hover:!bg-[#F4F2EC] hover:!text-[#1F2410]"
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
                                          onSupplyDrop(
                                            item.aidStationIndex as number,
                                            product.id,
                                            quantity - 1,
                                            supplyDropOptions
                                          );
                                        }
                                      }}
                                    >
                                      –
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      className="!min-h-0 h-6 w-6 rounded-full px-0 !text-[#8A917E] hover:!bg-[#F4F2EC] hover:!text-[#1F2410]"
                                      onClick={() => {
                                        if (item.isStart) {
                                          onStartSupplyDrop(product.id, 1);
                                        } else {
                                          onSupplyDrop(item.aidStationIndex as number, product.id, 1, supplyDropOptions);
                                        }
                                      }}
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                                );
                              })
                            : null}
                        </div>
                        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                          {waterRefillToggle}
                          {solidRefillToggle}
                          {assistanceAllowedToggle}
                          <Button
                            id={item.isStart ? "onboarding-open-products-btn" : undefined}
                            type="button"
                            variant="outline"
                            className="!min-h-0 h-9 w-9 shrink-0 rounded-full !border-0 !bg-[#2D5016] p-0 text-lg !text-[#FAF8F2] hover:!bg-[#3F6B1F]"
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
                  ) : typeof item.aidStationIndex === "number" && !isCollapsed ? (
                    <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F4F2EC] p-3 text-[12px] font-medium text-[#5C6450]">
                      <span className="min-w-0">
                        {locale === "fr"
                          ? "Pas d’assistance : tes produits perso sont à porter depuis le point d’assistance précédent."
                          : "No crew access: personal products must be carried from the previous crew point."}
                      </span>
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {waterRefillToggle}
                        {solidRefillToggle}
                        {assistanceAllowedToggle}
                        {organizerSuggestions.length > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="!min-h-0 h-9 w-9 shrink-0 rounded-full !border-0 !bg-[#2D5016] p-0 text-lg !text-[#FAF8F2] hover:!bg-[#3F6B1F]"
                            onClick={() =>
                              setSupplyPicker({
                                type: "aid",
                                index: item.aidStationIndex as number,
                              })
                            }
                            aria-label={timelineCopy.pickupTitle}
                            title={timelineCopy.pickupTitle}
                          >
                            +
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null;

                const sectionComputation = isCollapsed ? null : sectionComputationByItemId.get(item.id);
                const sectionSegment = sectionComputation?.sectionSegment;
                const upcomingSegmentIndex = sectionComputation?.upcomingSegmentIndex ?? null;
                const sectionKey = sectionComputation?.sectionKey ?? null;
                const storedSectionSegments = sectionComputation?.storedSectionSegments ?? null;
                const resolvedSectionSegments = sectionComputation?.resolvedSectionSegments ?? [];
                const hasStoredSubSections = sectionComputation?.hasStoredSubSections ?? false;
                const sectionStats = sectionComputation?.sectionStats ?? null;
                const sectionTotals = sectionComputation?.sectionTotals ?? null;
                const sectionSummaryDistanceKm = sectionTotals?.distanceKm ?? sectionSegment?.segmentKm ?? 0;
                const sectionSummaryMinutes =
                  sectionTotals?.etaSeconds !== undefined
                    ? sectionTotals.etaSeconds / 60
                    : sectionSegment?.segmentMinutes ?? 0;
                const sectionSummaryGain = sectionTotals?.dPlus ?? sectionSegment?.elevationGainM ?? 0;
                const sectionSummaryLoss = sectionTotals?.dMinus ?? sectionSegment?.elevationLossM ?? 0;
                const plannedFuel = carryoverCoverage?.currentCarbs ?? summarized?.totals.carbs ?? 0;
                const plannedSodium = carryoverCoverage?.currentSodium ?? summarized?.totals.sodium ?? 0;
                const plannedWater = sectionSegment?.plannedWaterMl ?? 0;
                const paceAdjustmentFieldName = sectionSegment
                  ? getSegmentFieldName(sectionSegment, "paceAdjustmentMinutesPerKm")
                  : null;
                const basePaceMinutesPerKm =
                  sectionTotals && sectionTotals.distanceKm > 0
                    ? sectionTotals.etaSeconds / 60 / sectionTotals.distanceKm
                    : sectionSegment && sectionSegment.segmentKm > 0
                      ? sectionSegment.estimatedSegmentMinutes / sectionSegment.segmentKm
                      : 0;
                const isPaceAdjustmentDisabled = hasStoredSubSections;
                const paceAdjustmentTooltip = isPaceAdjustmentDisabled ? segmentCopy.paceAdjustmentDisabled : undefined;
                const paceAdjustmentControl =
                  sectionSegment && paceAdjustmentFieldName
                    ? renderPaceAdjustmentControl({
                        basePaceMinutesPerKm,
                        paceAdjustmentMinutesPerKm: sectionSegment?.paceAdjustmentMinutesPerKm,
                        fieldName: paceAdjustmentFieldName,
                        isDisabled: isPaceAdjustmentDisabled,
                        tooltip: paceAdjustmentTooltip,
                      })
                    : null;
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
                    helperIsWarning: Boolean(capacityWarning),
                    statusLabel: status.label,
                    statusTone: status.tone,
                    icon: metricIcons[metric.key],
                  };
                });

                const sectionAvgPace =
                  sectionSummaryDistanceKm > 0
                    ? sectionSummaryMinutes / sectionSummaryDistanceKm
                    : 0;

                const segmentCard =
                  sectionSegment ? (
                    <SegmentCard
                      variant={isCollapsed ? "compact" : "section"}
                      distanceText={`${formatKmPost(sectionSummaryDistanceKm, locale)} km`}
                      timeText={formatMinutes(sectionSummaryMinutes)}
                      elevationGainText={`${Math.round(sectionSummaryGain)} D+`}
                      elevationLossText={`${Math.round(sectionSummaryLoss)} D-`}
                      paceControl={
                        <span className="font-[family-name:var(--font-plan-mono)] text-[13px] font-bold tabular-nums text-[#1F2410]">
                          {formatPaceValue(sectionAvgPace)}/km
                        </span>
                      }
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

                const segmentLabelLookup = {
                  climb: segmentCopy.markerTypes.climb,
                  descent: segmentCopy.markerTypes.descent,
                  flat: segmentCopy.markerTypes.flat,
                  custom: segmentCopy.markerTypes.custom,
                };
                const canSplitSection = (item.isStart || isAidStation) && sectionSegment;
                const segmentListItems =
                  canSplitSection
                    ? (() => {
                        let runningStartKm = sectionSegment.startDistanceKm;
                        const hasBasePace =
                          typeof baseMinutesPerKm === "number" &&
                          Number.isFinite(baseMinutesPerKm) &&
                          baseMinutesPerKm > 0;
                        const fallbackPaceControl = !hasStoredSubSections ? paceAdjustmentControl : null;
                        return resolvedSectionSegments.map((segment, index) => {
                          const stats = sectionStats?.segmentStats[index];
                          const rawLabel = segment.label?.trim();
                          const resolvedLabel =
                            rawLabel && rawLabel in segmentLabelLookup
                              ? segmentLabelLookup[rawLabel as keyof typeof segmentLabelLookup]
                              : rawLabel ||
                                timelineCopy.segmentLabel.replace(
                                  "{distance}",
                                  (stats?.distKm ?? segment.segmentKm).toFixed(1)
                                );
                          const startDistanceKm = runningStartKm;
                          const endDistanceKm = Number((startDistanceKm + segment.segmentKm).toFixed(3));
                          runningStartKm = endDistanceKm;
                          const segmentPaceFieldName = sectionKey
                            ? (`sectionSegments.${sectionKey}.${index}.paceAdjustmentMinutesPerKm` as Path<FormValues>)
                            : null;
                          const subsectionBasePaceMinutesPerKm =
                            stats && hasBasePace
                              ? getAdjustedPaceMinutesPerKm(baseMinutesPerKm as number, {
                                  distKm: stats.distKm,
                                  dPlus: stats.dPlus,
                                  dMinus: stats.dMinus,
                                  elapsedBeforeSeconds: stats.elapsedStartSeconds,
                                  fatigueLevel,
                                }) ?? (baseMinutesPerKm as number)
                              : (baseMinutesPerKm as number);
                          const paceControl =
                            fallbackPaceControl ??
                            (hasBasePace && segmentPaceFieldName
                              ? renderPaceAdjustmentControl({
                                  basePaceMinutesPerKm: subsectionBasePaceMinutesPerKm,
                                  paceAdjustmentMinutesPerKm: segment.paceAdjustmentMinutesPerKm,
                                  fieldName: segmentPaceFieldName,
                                  isDisabled: false,
                                })
                              : null);
                          return {
                            id: `${item.id}-segment-${index}`,
                            label: resolvedLabel,
                            distanceKm: stats?.distKm ?? segment.segmentKm,
                            elevationGainM: stats?.dPlus ?? 0,
                            elevationLossM: stats?.dMinus ?? 0,
                            etaMinutes: (stats?.etaSeconds ?? 0) / 60,
                            paceAdjustmentMinutesPerKm: segment.paceAdjustmentMinutesPerKm,
                            paceControl,
                            segmentIndex: index,
                            startDistanceKm,
                            endDistanceKm,
                          };
                        });
                      })()
                    : [];
                const segmentToggleKey = item.isStart ? "start" : isAidStation ? String(item.aidStationIndex) : null;
                const isSegmentsExpanded =
                  segmentToggleKey && segmentListItems.length > 0 ? Boolean(expandedSegments[segmentToggleKey]) : false;
                const segmentToggleLabel = isSegmentsExpanded ? segmentCopy.toggle.hide : segmentCopy.toggle.show;
                const markerTitlePrefix = segmentCopy.actions.addMarker.replace(/^\+\s*/, "");
                const autoSegmentTitlePrefix = segmentCopy.actions.autoSegment;
                const segmentToggleButton =
                  segmentToggleKey && segmentListItems.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="!min-h-0 h-8 rounded-full !bg-white px-3 text-xs font-semibold !text-[#2D5016] ring-1 ring-[#E5E2D8] hover:!bg-[#E8F0E0]"
                      onClick={() =>
                        startUiTransition(() => {
                          setExpandedSegments((prev) => ({
                            ...prev,
                            [segmentToggleKey]: !isSegmentsExpanded,
                          }));
                        })
                      }
                    >
                      {segmentToggleLabel}
                    </Button>
                  ) : null;
                const segmentActions =
                  isSegmentsExpanded && segmentListItems.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() =>
                          setSegmentModalState({
                            type: "marker",
                            aidStationIndex: item.isStart ? null : (item.aidStationIndex as number),
                            sectionIndex: upcomingSegmentIndex as number,
                            startDistanceKm: sectionSegment?.startDistanceKm ?? 0,
                            endDistanceKm: sectionSegment?.distanceKm ?? 0,
                            title: `${markerTitlePrefix} · ${item.title}`,
                          })
                        }
                      >
                        {segmentCopy.actions.addMarker}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs"
                        onClick={() =>
                          setSegmentModalState({
                            type: "auto",
                            aidStationIndex: item.isStart ? null : (item.aidStationIndex as number),
                            sectionIndex: upcomingSegmentIndex as number,
                            startDistanceKm: sectionSegment?.startDistanceKm ?? 0,
                            endDistanceKm: sectionSegment?.distanceKm ?? 0,
                            title: `${autoSegmentTitlePrefix} · ${item.title}`,
                          })
                        }
                      >
                        {segmentCopy.actions.autoSegment}
                      </Button>
                    </div>
                  ) : null;
                const sectionBlock =
                  sectionSegment && segmentCard ? (
                    <BetweenAidStationSection
                      sectionSummary={segmentCard}
                      nutritionCards={nutritionCards}
                      toggleButton={segmentToggleButton}
                      showSubSections={isSegmentsExpanded && segmentListItems.length > 0}
                      subSections={
                        isSegmentsExpanded && segmentListItems.length > 0 ? (
                          <>
                            {segmentListItems.map((segment) => (
                              <SubSectionRow
                                key={segment.id}
                                label={segment.label}
                                distanceKm={segment.distanceKm}
                                elevationGainM={segment.elevationGainM}
                                elevationLossM={segment.elevationLossM}
                                etaMinutes={segment.etaMinutes}
                                etaLabel={timelineCopy.etaLabel}
                                formatDistance={formatDistanceWithUnit}
                                formatMinutes={formatMinutes}
                                elevationProfile={sortedElevationProfile}
                                startDistanceKm={segment.startDistanceKm}
                                endDistanceKm={segment.endDistanceKm}
                                copy={copy}
                                baseMinutesPerKm={baseMinutesPerKm}
                                deleteLabel={hasStoredSubSections ? segmentCopy.actions.delete : undefined}
                                editLabel={hasStoredSubSections ? segmentCopy.actions.edit : undefined}
                                paceControl={segment.paceControl}
                                segmentIndex={segment.segmentIndex}
                                onDelete={
                                  hasStoredSubSections && typeof upcomingSegmentIndex === "number" && sectionSegment
                                    ? (segmentIndex) =>
                                        handleDeleteSubSection(upcomingSegmentIndex, segmentIndex)
                                    : undefined
                                }
                                onEdit={
                                  hasStoredSubSections && typeof upcomingSegmentIndex === "number" && sectionSegment
                                    ? (segmentIndex) => {
                                        const segmentToEdit = storedSectionSegments?.[segmentIndex];
                                        if (!segmentToEdit) return;
                                        setSegmentModalState({
                                          type: "edit",
                                          sectionIndex: upcomingSegmentIndex,
                                          segmentIndex,
                                          totalKm: sectionSegment.segmentKm,
                                          segmentKm: segmentToEdit.segmentKm,
                                          label: segmentToEdit.label ?? "",
                                          title: `${segmentCopy.actions.edit} · ${item.title}`,
                                        });
                                      }
                                    : undefined
                                }
                              />
                            ))}
                          </>
                        ) : null
                      }
                      subSectionActions={isSegmentsExpanded && segmentListItems.length > 0 ? segmentActions : null}
                    />
                  ) : null;

                const removeButton =
                  typeof item.aidStationIndex === "number" && !item.isFinish ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="!min-h-0 h-9 w-9 rounded-full px-0 !text-[#8A917E] hover:!bg-[#FDECEA] hover:!text-[#C0392B]"
                      onClick={() => onRemoveAidStation(item.aidStationIndex as number)}
                      title={`${aidStationsCopy.remove} ${item.title}`}
                    >
                      <Trash2 className="h-[18px] w-[18px]" />
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
                      return `${liters.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
                        minimumFractionDigits: liters < 10 ? 1 : 0,
                        maximumFractionDigits: liters < 10 ? 1 : 0,
                      })} L`;
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
                        : finishSummary.totalGels.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })
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
                    icon: <PaceIcon size={18} strokeWidth={2} />,
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
                    icon: <NutritionIcon size={18} strokeWidth={2} />,
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
                    icon: <HydrationIcon size={18} strokeWidth={2} />,
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
                    <RailItem key={item.id} marker={aidStationBadge}>
                      <FinishSummaryCard
                        pointIndex={pointNumber}
                        badge={aidStationBadge ?? undefined}
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
                    </RailItem>
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
                      dotClassName: "bg-[#2D5016]",
                    },
                    {
                      key: "water",
                      label: copy.sections.summary.items.water,
                      value: formatItemCount(waterCount, "flask", "flasks"),
                      dotClassName: "bg-[#3F6F8F]",
                    },
                    {
                      key: "sodium",
                      label: copy.sections.summary.items.sodium,
                      value: formatItemCount(sodiumCount, "cap", "caps"),
                      dotClassName: "bg-[#F0873A]",
                    },
                  ];
                  return (
                    <RailItem key={item.id} marker={aidStationBadge}>
                      <AidStationCollapsedRow
                        pointIndex={pointNumber}
                        badge={aidStationBadge ?? undefined}
                        title={item.title}
                        leftIcon={isAidStation ? undefined : pointIconLarge}
                        metaLine={
                          item.isStart
                            ? `km ${formatKmPost(item.distanceKm, locale)}`
                            : `km ${formatKmPost(item.distanceKm, locale)}   ${locale === "fr" ? "passage" : "arrival"} ${formatMinutes(item.etaMinutes)}`
                        }
                        pauseLine={pauseMinutesValue > 0 ? `${locale === "fr" ? "Pause" : "Stop"} ${pauseMinutesValue} min` : ""}
                        segmentCard={segmentCard}
                        embarkedItems={embarkedItems}
                        actions={
                          <div className="flex items-center gap-3">
                            {toggleButton}
                            {removeButton}
                          </div>
                        }
                      />
                    </RailItem>
                  );
                }

                return (
                  <RailItem key={item.id} marker={aidStationBadge}>
                    <div className="flex flex-col">
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
                                    maxStopMinutes: item.checkpointSegment?.maxStopMinutes,
                                    waterRefill: item.checkpointSegment?.waterRefill !== false,
                                    solidRefill: item.checkpointSegment?.solidRefill !== false,
                                    assistanceAllowed: item.checkpointSegment?.assistanceAllowed !== false,
                                  })
                            : undefined
                        }
                      />
                      {organizerSuggestionsBlock}
                      {sectionBlock}
                    </div>
                  </RailItem>
                );
              });
              if (!sampleMode || renderedItems.length <= sampleMode.editableItemCount) return renderedItems;
              return (
                <>
                  {renderedItems.slice(0, sampleMode.editableItemCount)}
                  <div className="relative z-10">
                    {sampleMode.lockedCta(
                      renderItems.slice(sampleMode.editableItemCount).filter((item) => !item.isFinish && !item.isStart).length,
                    )}
                  </div>
                  {/* Locked preview: real points stay visible to show what the full plan holds, but cannot be used. */}
                  <div
                    aria-hidden="true"
                    ref={(node) => node?.setAttribute("inert", "")}
                    className="pointer-events-none relative max-h-[42rem] select-none space-y-8 overflow-hidden opacity-60 blur-[2px]"
                  >
                    {renderedItems.slice(sampleMode.editableItemCount)}
                    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#FAF8F2] to-transparent" />
                  </div>
                </>
              );
            })()}
          </div>
        ) : null}
        </CardContent>
      </Card>
      <AutoSegmentModal
        open={segmentModalState?.type === "auto"}
        title={segmentModalState?.type === "auto" ? segmentModalState.title : undefined}
        copy={segmentCopy}
        onClose={() => setSegmentModalState(null)}
        onConfirm={handleAutoSegmentConfirm}
      />
      <AddMarkerModal
        open={segmentModalState?.type === "marker"}
        title={segmentModalState?.type === "marker" ? segmentModalState.title : undefined}
        copy={segmentCopy}
        onClose={() => setSegmentModalState(null)}
        onConfirm={handleAddMarkerConfirm}
      />
      <EditSubSectionModal
        open={segmentModalState?.type === "edit"}
        title={segmentModalState?.type === "edit" ? segmentModalState.title : undefined}
        copy={segmentCopy}
        initialDistanceKm={segmentModalState?.type === "edit" ? segmentModalState.segmentKm : 0}
        initialLabel={segmentModalState?.type === "edit" ? segmentModalState.label : ""}
        maxDistanceKm={segmentModalState?.type === "edit" ? segmentModalState.totalKm : undefined}
        onClose={() => setSegmentModalState(null)}
        onConfirm={handleEditSubSectionConfirm}
      />
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
                  {editorState.maxStopMinutes && Number(editorState.pauseMinutes || 0) > editorState.maxStopMinutes ? <p className="text-xs font-medium text-amber-700">La pause dépasse la limite organisateur de {editorState.maxStopMinutes} min.</p> : null}
                </div>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground dark:bg-slate-900/60 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={editorState.waterRefill}
                    onChange={(event) => updateEditorService("waterRefill", event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-background text-emerald-500 focus:ring-ring dark:bg-slate-900"
                  />
                  <span>
                    <span className="block font-semibold text-foreground dark:text-slate-50">
                      {aidStationsCopy.labels.waterRefill}
                    </span>
                    {locale === "fr" ? "Remplissage des flasques." : "Bottle refill."}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground dark:bg-slate-900/60 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={editorState.solidRefill}
                    onChange={(event) => updateEditorService("solidRefill", event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-background text-emerald-500 focus:ring-ring dark:bg-slate-900"
                  />
                  <span>
                    <span className="block font-semibold text-foreground dark:text-slate-50">
                      {aidStationsCopy.labels.solidRefill}
                    </span>
                    {locale === "fr" ? "Gels, boisson et sodium." : "Gels, drink mix, and sodium."}
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground dark:bg-slate-900/60 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={editorState.assistanceAllowed}
                    onChange={(event) => updateEditorService("assistanceAllowed", event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border bg-background text-emerald-500 focus:ring-ring dark:bg-slate-900"
                  />
                  <span>
                    <span className="block font-semibold text-foreground dark:text-slate-50">
                      {locale === "fr" ? "Assistance" : "Crew access"}
                    </span>
                    {locale === "fr" ? "L'equipe peut donner tes produits." : "Crew can hand over personal products."}
                  </span>
                </label>
              </div>
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
            <div>
              <Link
                href="/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Créer un nouveau produit
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder={copy.sections.gels.filters.searchPlaceholder}
                className="w-full max-w-md border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-md border border-border overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPickerShowMyProducts(false)}
                    className={`px-3 py-1.5 transition-colors ${!pickerShowMyProducts ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"}`}
                  >
                    Tous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickerShowMyProducts(true)}
                    className={`px-3 py-1.5 transition-colors ${pickerShowMyProducts ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"}`}
                  >
                    Mes produits
                  </button>
                </div>
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
                <div className="flex flex-col items-end gap-1">
                  <p className="text-xs text-muted-foreground dark:text-slate-300">
                    {pickerFavorites.length} favoris sélectionnés
                  </p>
                </div>
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
                  {pickerTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        Aucun produit trouvé.
                      </td>
                    </tr>
                  ) : pickerTableRows.map((row) => {
                      if (row.type === "group") {
                        return (
                          <tr key={row.key} className="border-t border-border bg-muted/50 dark:bg-slate-900/50">
                            <td colSpan={7} className="px-4 py-2">
                              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {row.brand}
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-[11px] text-foreground dark:bg-slate-950 dark:text-slate-200">
                                  {row.count}
                                </span>
                              </span>
                            </td>
                          </tr>
                        );
                      }
                      const product = row.product;
                      const isSelected = supplyPickerSelectedSlugs.includes(product.slug);
                      const isFavorite = pickerFavoriteSet.has(product.slug);
                      const isOrganizerAidProduct = supplyPickerOrganizerProductIds.has(product.id);
                      return (
                        <tr key={product.slug} className="border-t border-border transition-colors hover:bg-muted/40 dark:hover:bg-slate-900/50">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className={`text-lg ${isFavorite ? "text-amber-500 dark:text-amber-300" : "text-muted-foreground dark:text-slate-500"} hover:text-amber-400 dark:hover:text-amber-200`}
                              onClick={() => toggleFavorite(product.slug)}
                              aria-label="Favori"
                            >
                              ★
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex min-w-[220px] items-center gap-3">
                              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background dark:bg-slate-900">
                                {isVerifiedProduct(product) ? (
                                  <VerifiedProductBadge
                                    locale={locale}
                                    className="absolute right-0.5 top-0.5 h-5 w-5"
                                  />
                                ) : null}
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-1.5" />
                                ) : (
                                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                                    {product.name.slice(0, 1)}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="min-w-0 text-left font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                                onClick={() => setProductDetail(product)}
                                aria-label={`${productDetailCopy[locale].title}: ${product.name}`}
                              >
                                {product.name}
                              </button>
                              {isOrganizerAidProduct ? (
                                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100">
                                  {locale === "fr" ? "Officiel ravito" : "Official aid"}
                                </span>
                              ) : null}
                            </div>
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
      <ProductDetailModal product={productDetail} locale={locale} onClose={() => setProductDetail(null)} />
    </>
  );
}
