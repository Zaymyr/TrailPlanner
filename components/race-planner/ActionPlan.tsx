"use client";

import type { UseFormRegister } from "react-hook-form";

import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues, Segment, SegmentPlan } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionHeader } from "../ui/SectionHeader";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowRightIcon, DropletsIcon, FlameIcon, SparklesIcon } from "./TimelineIcons";
import { TimelinePointCard } from "./TimelineCards";

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
  onAddAidStation: () => void;
  onRemoveAidStation: (index: number) => void;
  register: UseFormRegister<FormValues>;
  formatDistanceWithUnit: (value: number) => string;
  formatMinutes: (totalMinutes: number) => string;
  formatFuelAmount: (value: number) => string;
  formatWaterAmount: (value: number) => string;
  formatSodiumAmount: (value: number) => string;
  calculatePercentage: (value: number, total?: number) => number;
};

const parseOptionalNumber = (value: string | number) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getSegmentFieldName = (segment: Segment, field: keyof SegmentPlan) => {
  if (segment.isFinish) return `finishPlan.${field}` as const;
  if (typeof segment.aidStationIndex === "number") {
    return `aidStations.${segment.aidStationIndex}.${field}` as const;
  }
  return null;
};

type RenderItem =
  | {
      kind: "point";
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
    }
  | {
      kind: "segment";
      id: string;
      segment: Segment;
      index: number;
    };

const buildRenderItems = (segments: Segment[]): RenderItem[] => {
  if (segments.length === 0) return [];

  const items: RenderItem[] = [];
  const startSegment = segments[0];

  items.push({
    kind: "point",
    id: `point-${startSegment.from}-start`,
    title: startSegment.from,
    distanceKm: startSegment.startDistanceKm,
    etaMinutes: 0,
    isStart: true,
    upcomingSegment: startSegment,
  });

  segments.forEach((segment, index) => {
    items.push({
      kind: "segment",
      id: `segment-${segment.from}-${segment.checkpoint}-${segment.distanceKm}`,
      segment,
      index: index + 1,
    });

    items.push({
      kind: "point",
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

export function ActionPlan({
  copy,
  segments,
  raceTotals,
  sectionId,
  onPrint,
  onAddAidStation,
  onRemoveAidStation,
  register,
  formatDistanceWithUnit,
  formatMinutes,
  formatFuelAmount,
  formatWaterAmount,
  formatSodiumAmount,
  calculatePercentage,
}: ActionPlanProps) {
  const timelineCopy = copy.sections.timeline;
  const aidStationsCopy = copy.sections.aidStations;
  const renderItems = buildRenderItems(segments);
  const metricIcons = {
    carbs: <FlameIcon className="h-4 w-4 text-purple-100" aria-hidden />,
    water: <DropletsIcon className="h-4 w-4 text-sky-100" aria-hidden />,
    sodium: <SparklesIcon className="h-4 w-4 text-slate-100" aria-hidden />,
  };
  const getPlanStatus = (planned: number, target: number) => {
    if (!Number.isFinite(target) || target <= 0) {
      return { label: timelineCopy.status.atTarget, tone: "neutral" as const };
    }
    const ratio = planned / target;
    if (ratio < 0.9) return { label: timelineCopy.status.belowTarget, tone: "warning" as const };
    if (ratio > 1.1) return { label: timelineCopy.status.aboveTarget, tone: "warning" as const };
    return { label: timelineCopy.status.atTarget, tone: "success" as const };
  };

  return (
    <Card id={sectionId}>
      <CardHeader className="space-y-3">
        <SectionHeader
          title={timelineCopy.title}
          description={timelineCopy.description}
          action={
            <div className="flex items-center gap-2">
              <Button type="button" onClick={onAddAidStation}>
                {aidStationsCopy.add}
              </Button>
              {segments.length > 0 ? (
                <Button type="button" variant="outline" className="hidden sm:inline-flex" onClick={onPrint}>
                  {copy.buttons.printPlan}
                </Button>
              ) : null}
            </div>
          }
        />
        {segments.length === 0 ? (
          <p className="text-sm text-slate-400">{timelineCopy.empty}</p>
        ) : (
          <p className="text-xs text-slate-400">
            {copy.sections.timeline.printView.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {segments.length > 0 ? (
          <div className="relative space-y-4">
            <div className="absolute left-[18px] top-0 h-full w-px bg-slate-800/70" aria-hidden />
            {renderItems.map((item, itemIndex) => {
              if (item.kind === "segment") {
                const { segment } = item;
                const distanceHelper = timelineCopy.segmentDistanceBetween.replace(
                  "{distance}",
                  segment.segmentKm.toFixed(1)
                );
                const timeFieldName = getSegmentFieldName(segment, "segmentMinutesOverride");
                const timeInput = timeFieldName ? (
                  <div className="flex w-full flex-col items-end gap-1">
                    <Label className="sr-only" htmlFor={timeFieldName}>
                      {timelineCopy.segmentTimeLabel}
                    </Label>
                    <Input
                      id={timeFieldName}
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={segment.plannedMinutesOverride ?? ""}
                      className="max-w-[180px]"
                      {...register(timeFieldName, {
                        setValueAs: parseOptionalNumber,
                      })}
                    />
                  </div>
                ) : null;

                const gelsFieldName = getSegmentFieldName(segment, "gelsPlanned");
                const recommendedGels = Math.max(0, Math.round(segment.recommendedGels * 10) / 10);
                const metrics = [
                  {
                    key: "carbs" as const,
                    label: timelineCopy.gelsBetweenLabel,
                    planned: segment.plannedFuelGrams,
                    target: segment.targetFuelGrams,
                    total: raceTotals?.fuelGrams,
                    format: formatFuelAmount,
                    input: gelsFieldName ? (
                      <div className="space-y-1">
                        <Label className="sr-only" htmlFor={gelsFieldName}>
                          {timelineCopy.gelsBetweenLabel}
                        </Label>
                        <Input
                          id={gelsFieldName}
                          type="number"
                          min="0"
                          step="0.5"
                          defaultValue={segment.gelsPlanned ?? ""}
                          placeholder={recommendedGels.toString()}
                          className="border-slate-800/70 bg-slate-950/80 text-sm"
                          {...register(gelsFieldName, {
                            setValueAs: parseOptionalNumber,
                          })}
                        />
                        <p className="text-[11px] text-slate-400">
                          {timelineCopy.targetLabel}: {formatFuelAmount(segment.targetFuelGrams)}
                        </p>
                      </div>
                    ) : null,
                  },
                  {
                    key: "water" as const,
                    label: copy.sections.summary.items.water,
                    planned: segment.plannedWaterMl,
                    target: segment.targetWaterMl,
                    total: raceTotals?.waterMl,
                    format: formatWaterAmount,
                  },
                  {
                    key: "sodium" as const,
                    label: copy.sections.summary.items.sodium,
                    planned: segment.plannedSodiumMg,
                    target: segment.targetSodiumMg,
                    total: raceTotals?.sodiumMg,
                    format: formatSodiumAmount,
                  },
                ];

                const inlineMetrics = metrics.map((metric) => {
                  const status = getPlanStatus(metric.planned, metric.target);
                  const targetPercent =
                    metric.target > 0 ? Math.max(0, Math.min((metric.planned / metric.target) * 100, 999)) : 0;
                  return {
                    key: metric.key,
                    label: metric.label,
                    value: metric.format(metric.planned),
                    targetText: `${timelineCopy.targetLabel}: ${metric.format(metric.target)}`,
                    targetPercent,
                    totalPercent: calculatePercentage(metric.planned, metric.total),
                    statusLabel: status.label,
                    statusTone: status.tone,
                    icon: metricIcons[metric.key],
                    input: metric.input,
                  };
                });

                return (
                  <div key={item.id} className="relative pl-20">
                    <div className="pointer-events-none absolute left-6 top-2 bottom-2 flex flex-col items-center" aria-hidden>
                      <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" />
                      <div className="relative mt-1 flex h-full w-px flex-col items-center">
                        <span className="absolute left-1/2 top-8 z-10 w-28 -translate-x-1/2 rounded-md border border-emerald-400/30 bg-slate-950/95 px-2 py-1 text-[11px] font-semibold text-slate-50 shadow-lg shadow-emerald-500/15">
                          <span className="block">{distanceHelper}</span>
                          <span className="block text-[10px] font-normal text-slate-300">
                            {timelineCopy.segmentTimeLabel}: {formatMinutes(segment.segmentMinutes)}
                          </span>
                        </span>
                        <span className="h-full w-px bg-gradient-to-b from-emerald-400 via-emerald-400/80 to-emerald-300" />
                      </div>
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/15">
                        <ArrowRightIcon className="h-3.5 w-3.5 -rotate-90 text-emerald-200" aria-hidden />
                      </span>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-50 shadow-sm shadow-emerald-500/10">
                          <span>{segment.from}</span>
                          <ArrowRightIcon className="h-4 w-4 text-emerald-200" aria-hidden />
                          <span>{segment.checkpoint}</span>
                        </div>
                        <div className="text-xs text-slate-300">
                          <p>
                            {timelineCopy.etaLabel}: {formatMinutes(segment.etaMinutes)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {timelineCopy.segmentTimeHelp} (≈ {formatMinutes(segment.estimatedSegmentMinutes)})
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 lg:flex-row">
                        {inlineMetrics.map((metric) => (
                          <div
                            key={metric.key}
                            className={`flex-1 rounded-lg border px-3 py-2 ${metric.key === "carbs" ? "border-purple-500/40 bg-purple-500/10" : metric.key === "water" ? "border-sky-500/40 bg-sky-500/10" : "border-slate-500/40 bg-slate-500/10"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-900">
                                  {metric.icon}
                                </span>
                                <p className="text-sm font-semibold text-slate-50">{metric.label}</p>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  metric.statusTone === "success"
                                    ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-50"
                                    : metric.statusTone === "warning"
                                      ? "border border-amber-400/40 bg-amber-500/15 text-amber-50"
                                      : "border border-slate-400/40 bg-slate-600/20 text-slate-50"
                                }`}
                              >
                                {metric.statusLabel}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-col gap-1 text-sm text-slate-50">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold">{metric.value}</span>
                                {metric.input ? <div className="max-w-[160px]">{metric.input}</div> : null}
                              </div>
                              <p className="text-[11px] text-slate-200">
                                {metric.targetText} · {metric.targetPercent.toFixed(0)}% ({metric.totalPercent.toFixed(0)}% total)
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              const pointNumber = itemIndex === 0 ? 1 : Math.ceil(itemIndex / 2) + 1;
              const pickupFieldName = item.checkpointSegment
                ? getSegmentFieldName(item.checkpointSegment, "pickupGels")
                : null;
              const distanceFieldName =
                typeof item.aidStationIndex === "number"
                  ? (`aidStations.${item.aidStationIndex}.distanceKm` as const)
                  : null;

              const nextSegment = item.upcomingSegment;
              const pointMetrics = ["carbs", "water", "sodium"].map((key) => {
                const metricKey = key as "carbs" | "water" | "sodium";
                const value =
                  metricKey === "carbs"
                    ? nextSegment?.plannedFuelGrams
                    : metricKey === "water"
                      ? nextSegment?.plannedWaterMl
                      : nextSegment?.plannedSodiumMg;
                const formattedValue =
                  metricKey === "carbs"
                    ? formatFuelAmount(value ?? 0)
                    : metricKey === "water"
                      ? formatWaterAmount(value ?? 0)
                      : formatSodiumAmount(value ?? 0);
                const target =
                  metricKey === "carbs"
                    ? formatFuelAmount(nextSegment?.targetFuelGrams ?? 0)
                    : metricKey === "water"
                      ? formatWaterAmount(nextSegment?.targetWaterMl ?? 0)
                      : formatSodiumAmount(nextSegment?.targetSodiumMg ?? 0);

                return {
                  key: metricKey,
                  label:
                    metricKey === "carbs"
                      ? timelineCopy.gelsBetweenLabel
                      : metricKey === "water"
                        ? copy.sections.summary.items.water
                        : copy.sections.summary.items.sodium,
                  value: nextSegment ? formattedValue : undefined,
                  helper: nextSegment ? `${timelineCopy.targetLabel}: ${target}` : undefined,
                  icon: metricIcons[metricKey],
                  muted: !nextSegment,
                };
              });

              return (
                <div key={item.id} className="relative pl-8">
                  <TimelinePointCard
                    pointIndex={pointNumber}
                    title={item.title}
                    distanceText={formatDistanceWithUnit(item.distanceKm)}
                    etaText={`${timelineCopy.etaLabel}: ${formatMinutes(item.etaMinutes)}`}
                    stockLabel={timelineCopy.pointStockLabel}
                    upcomingHelper={timelineCopy.pointStockHelper}
                    metrics={pointMetrics}
                    distanceInput={
                      distanceFieldName ? (
                        <div className="space-y-1 text-right sm:text-left">
                          <Label className="text-[11px] text-slate-300" htmlFor={distanceFieldName}>
                            {aidStationsCopy.labels.distance}
                          </Label>
                          <Input
                            id={distanceFieldName}
                            type="number"
                            step="0.5"
                            className="max-w-[160px] border-slate-800/70 bg-slate-950/80 text-sm"
                            {...register(distanceFieldName, { valueAsNumber: true })}
                          />
                        </div>
                      ) : null
                    }
                    pickupLabel={timelineCopy.pickupTitle}
                    pickupHelper={timelineCopy.pickupHelper}
                    pickupInput={
                      pickupFieldName && !item.isFinish ? (
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-200" htmlFor={pickupFieldName}>
                            {timelineCopy.pickupGelsLabel}
                          </Label>
                          <Input
                            id={pickupFieldName}
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={item.pickupGels ?? ""}
                            className="border-slate-800/70 bg-slate-950/80 text-sm"
                            {...register(pickupFieldName, {
                              setValueAs: parseOptionalNumber,
                            })}
                          />
                        </div>
                      ) : null
                    }
                    finishLabel={copy.defaults.finish}
                    removeAction={
                      typeof item.aidStationIndex === "number" && !item.isFinish ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2 text-[11px] font-semibold text-red-200 hover:text-red-100"
                          onClick={() => onRemoveAidStation(item.aidStationIndex as number)}
                        >
                          {aidStationsCopy.remove}
                        </Button>
                      ) : null
                    }
                    isStart={item.isStart}
                    isFinish={item.isFinish}
                  />
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
