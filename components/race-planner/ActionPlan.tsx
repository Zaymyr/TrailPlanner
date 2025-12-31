"use client";

import { useCallback, useMemo, useState } from "react";
import type { UseFormRegister } from "react-hook-form";

import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues, Segment, SegmentPlan, StationSupply } from "../../app/(coach)/race-planner/types";
import type { FuelProduct } from "../../lib/product-types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionHeader } from "../ui/SectionHeader";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon, DropletsIcon, FlameIcon, SparklesIcon } from "./TimelineIcons";
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
  onAddAidStation: (station: { name: string; distanceKm: number }) => void;
  onRemoveAidStation: (index: number) => void;
  register: UseFormRegister<FormValues>;
  setValue: (field: `aidStations.${number}.name` | `aidStations.${number}.distanceKm`, value: string | number) => void;
  formatDistanceWithUnit: (value: number) => string;
  formatMinutes: (totalMinutes: number) => string;
  formatFuelAmount: (value: number) => string;
  formatWaterAmount: (value: number) => string;
  formatSodiumAmount: (value: number) => string;
  calculatePercentage: (value: number, total?: number) => number;
  fuelProducts: FuelProduct[];
  startSupplies: StationSupply[];
  onStartSupplyDrop: (productId: string, quantity?: number) => void;
  onStartSupplyRemove: (productId: string) => void;
  onSupplyDrop: (aidStationIndex: number, productId: string, quantity?: number) => void;
  onSupplyRemove: (aidStationIndex: number, productId: string) => void;
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
  setValue,
  formatDistanceWithUnit,
  formatMinutes,
  formatFuelAmount,
  formatWaterAmount,
  formatSodiumAmount,
  calculatePercentage,
  fuelProducts,
  startSupplies,
  onStartSupplyDrop,
  onStartSupplyRemove,
  onSupplyDrop,
  onSupplyRemove,
}: ActionPlanProps) {
  const [collapsedAidStations, setCollapsedAidStations] = useState<Record<string, boolean>>({});
  const [editorState, setEditorState] = useState<
    | null
    | {
        mode: "edit";
        index: number;
        name: string;
        distance: string;
      }
    | {
        mode: "create";
        name: string;
        distance: string;
      }
  >(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [supplyPicker, setSupplyPicker] = useState<{ type: "start" | "aid"; index?: number } | null>(null);
  const [pickerFavorites, setPickerFavorites] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerSort, setPickerSort] = useState<{ key: "name" | "carbs" | "sodium" | "calories"; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const timelineCopy = copy.sections.timeline;
  const aidStationsCopy = copy.sections.aidStations;
  const openCreateEditor = () =>
    setEditorState({
      mode: "create",
      name: copy.defaults.aidStationName,
      distance: "0",
    });
  const updateEditorField = useCallback((field: "name" | "distance", value: string) => {
    setEditorState((current) => (current ? { ...current, [field]: value } : current));
    setEditorError(null);
  }, []);
  const productBySlug = useMemo(() => Object.fromEntries(fuelProducts.map((product) => [product.slug, product])), [fuelProducts]);
  const renderItems = buildRenderItems(segments);
  const productById = useMemo(() => Object.fromEntries(fuelProducts.map((product) => [product.id, product])), [fuelProducts]);
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
    const deviation = Math.abs(1 - ratio);
    const label =
      ratio < 0.95
        ? timelineCopy.status.belowTarget
        : ratio > 1.05
          ? timelineCopy.status.aboveTarget
          : timelineCopy.status.atTarget;
    if (deviation < 0.1) return { label: timelineCopy.status.atTarget, tone: "success" as const };
    if (deviation < 0.25) return { label, tone: "warning" as const };
    return { label, tone: "danger" as const };
  };
  const statusToneStyles = {
    success: "border-emerald-400/40 bg-emerald-500/20 text-emerald-50",
    warning: "border-amber-400/40 bg-amber-500/15 text-amber-50",
    danger: "border-rose-400/40 bg-rose-500/20 text-rose-50",
    neutral: "border-slate-400/40 bg-slate-600/20 text-slate-50",
  } as const;
  const statusToneIcons = {
    success: "✓",
    warning: "!",
    danger: "×",
    neutral: "•",
  } as const;
  const prioritizeStatus = <T extends { tone: keyof typeof statusToneStyles; label: string }>(
    statuses: T[],
    fallback: T
  ) => {
    const tonePriority: Record<keyof typeof statusToneStyles, number> = {
      neutral: 0,
      success: 1,
      warning: 2,
      danger: 3,
    };
    return statuses.reduce((current, candidate) => {
      if (!current) return candidate;
      return tonePriority[candidate.tone] > tonePriority[current.tone] ? candidate : current;
    }, fallback);
  };
  const toggleAidStationCollapse = (collapseKey: string) => {
    setCollapsedAidStations((current) => ({
      ...current,
      [collapseKey]: !current[collapseKey],
    }));
  };
  const closeEditor = useCallback(() => {
    setEditorState(null);
    setEditorError(null);
  }, []);

  const handleEditorSave = useCallback(() => {
    if (!editorState) return;
    const name = editorState.name.trim();
    const distanceValue = Number(editorState.distance);
    if (!name) {
      setEditorError(copy.validation.required);
      return;
    }
    if (!Number.isFinite(distanceValue) || distanceValue < 0) {
      setEditorError(copy.validation.nonNegative);
      return;
    }
    if (editorState.mode === "edit") {
      setValue(`aidStations.${editorState.index}.name`, name);
      setValue(`aidStations.${editorState.index}.distanceKm`, distanceValue);
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
  const toggleFavorite = (slug: string) => {
    setPickerFavorites((current) => {
      const exists = current.includes(slug);
      if (exists) return current.filter((item) => item !== slug);
      if (current.length >= 3) return current;
      return [...current, slug];
    });
  };

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
              <Button type="button" onClick={openCreateEditor}>
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
        {segments.length === 0 ? <p className="text-sm text-slate-400">{timelineCopy.empty}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {segments.length > 0 ? (
          <div className="relative space-y-4">
            <div className="absolute left-[18px] top-0 h-full w-px bg-slate-800/70" aria-hidden />
            {(() => {
              let carrySupplies: StationSupply[] = startSupplies;
              let hideNextSegment = false;
              return renderItems.map((item, itemIndex) => {
                if (item.kind === "segment") {
                  if (hideNextSegment) {
                    hideNextSegment = false;
                    return null;
                  }
                  const { segment } = item;
                  const carriedTotals = summarizeSupplies(carrySupplies);
                  const plannedFuel = carriedTotals?.totals.carbs ?? 0;
                  const plannedWater = segment.plannedWaterMl;
                  const plannedSodium = carriedTotals?.totals.sodium ?? 0;
                  const distanceHelper = timelineCopy.segmentDistanceBetween.replace("{distance}", segment.segmentKm.toFixed(1));
                  const segmentRange = `${formatDistanceWithUnit(segment.startDistanceKm)} → ${formatDistanceWithUnit(segment.distanceKm)}`;
                  const segmentPath = `${segment.from} → ${segment.checkpoint}`;
                  const railDistance = `${segment.segmentKm.toFixed(1)} km`;
                const railTime = formatMinutes(segment.segmentMinutes);
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
                    planned: plannedFuel,
                    target: segment.targetFuelGrams,
                    total: raceTotals?.fuelGrams,
                    format: formatFuelAmount,
                  },
                  {
                    key: "water" as const,
                    label: copy.sections.summary.items.water,
                    planned: plannedWater,
                    target: segment.targetWaterMl,
                    total: raceTotals?.waterMl,
                    format: formatWaterAmount,
                  },
                  {
                    key: "sodium" as const,
                    label: copy.sections.summary.items.sodium,
                    planned: plannedSodium,
                    target: segment.targetSodiumMg,
                    total: raceTotals?.sodiumMg,
                    format: formatSodiumAmount,
                  },
                ];

                const inlineMetrics = metrics.map((metric) => {
                  const plannedForStatus =
                    metric.key === "water" && metric.target > 0 ? Math.min(metric.planned, metric.target) : metric.planned;
                  const status = getPlanStatus(plannedForStatus, metric.target);
                  const targetPercent =
                    metric.target > 0 ? Math.max(0, Math.min((plannedForStatus / metric.target) * 100, 999)) : 0;
                  const capacityLabel =
                    metric.key === "water" && typeof segment.waterCapacityMl === "number" && segment.waterCapacityMl > 0
                      ? timelineCopy.waterCapacityLabel.replace(
                          "{capacity}",
                          formatWaterAmount(segment.waterCapacityMl)
                        )
                      : null;
                  const capacityWarning =
                    metric.key === "water" && typeof segment.waterShortfallMl === "number" && segment.waterShortfallMl > 0
                      ? timelineCopy.waterCapacityWarning.replace(
                          "{missing}",
                          formatWaterAmount(segment.waterShortfallMl)
                        )
                      : null;
                  return {
                    key: metric.key,
                    label: metric.label,
                    value: metric.format(metric.planned),
                    format: metric.format,
                    targetValue: metric.target,
                    targetText: `${timelineCopy.targetLabel}: ${metric.format(metric.target)}`,
                    helper: capacityWarning ?? capacityLabel ?? null,
                    targetPercent,
                    totalPercent: calculatePercentage(metric.planned, metric.total),
                    statusLabel: status.label,
                    statusTone: status.tone,
                    icon: metricIcons[metric.key],
                  };
                });

                  return (
                    <div
                      key={item.id}
                      className="relative rounded-2xl border border-slate-800/70 bg-slate-950/70 p-4 pl-20 shadow-[0_8px_30px_rgba(15,23,42,0.45)]"
                    >
                      <div className="pointer-events-none absolute left-6 top-4 bottom-4 flex flex-col items-center" aria-hidden>
                        <span className="h-3 w-3 rounded-full bg-emerald-300 shadow-[0_0_0_3px_rgba(52,211,153,0.25)]" />
                        <div className="relative flex h-full w-px items-center justify-center">
                          <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-emerald-400/30 bg-slate-950/95 px-2 py-1 text-[10px] font-semibold text-slate-50 shadow-lg shadow-emerald-500/15">
                            <span className="block leading-tight">{railDistance}</span>
                            <span className="block text-[10px] font-normal text-emerald-50/80 leading-tight">
                              {railTime}
                            </span>
                          </span>
                          <span className="h-full w-px bg-gradient-to-b from-emerald-400 via-emerald-400/80 to-emerald-300" />
                        </div>
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/60 bg-emerald-500/15">
                          <ArrowRightIcon className="h-3.5 w-3.5 rotate-90 text-emerald-200" aria-hidden />
                        </span>
                      </div>

                      <div className="mb-3 flex items-center gap-3 text-[12px] text-slate-200">
                        <div className="h-px flex-1 rounded-full bg-slate-800" aria-hidden />
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 font-semibold">
                          <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden />
                          <span className="text-slate-100">{segmentPath}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-100">{segmentRange}</span>
                        </div>
                        <div className="h-px flex-1 rounded-full bg-slate-800" aria-hidden />
                      </div>

                      <div className="flex flex-col gap-2 lg:flex-row">
                        {inlineMetrics.map((metric) => (
                          // Visual status cards for each resource (carbs, water, sodium)
                          <div
                            key={metric.key}
                            className={`flex-1 rounded-2xl border bg-slate-950/85 p-4 shadow-inner ${
                              metric.statusTone === "success"
                                ? "border-emerald-500/50 shadow-emerald-500/10"
                                : metric.statusTone === "warning"
                                  ? "border-amber-500/50 shadow-amber-500/10"
                                  : metric.statusTone === "danger"
                                    ? "border-rose-500/50 shadow-rose-500/10"
                                    : "border-slate-500/40 shadow-slate-500/10"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border bg-slate-900 ${
                                    metric.key === "carbs"
                                      ? "border-purple-400/40"
                                      : metric.key === "water"
                                        ? "border-sky-400/40"
                                        : "border-slate-400/40"
                                  }`}
                                >
                                  {metric.icon}
                                </span>
                                <div className="flex flex-col">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    {metric.label}
                                  </p>
                                  <p className="text-sm font-semibold text-slate-50">
                                    {metric.key === "carbs"
                                      ? copy.sections.summary.items.carbs
                                      : metric.key === "water"
                                        ? copy.sections.summary.items.water
                                        : copy.sections.summary.items.sodium}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusToneStyles[metric.statusTone]}`}
                              >
                                {metric.statusLabel}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-col gap-3">
                              <p className="text-3xl font-extrabold leading-tight text-slate-50">{metric.value}</p>
                      <div className="space-y-2">
                        {(() => {
                          const targetValue = Math.max(metric.targetValue, 0);
                          const maxValueCandidate =
                            metric.key === "water" && typeof segment.waterCapacityMl === "number" && segment.waterCapacityMl > 0
                              ? segment.waterCapacityMl
                              : targetValue;
                          const maxValue = Math.max(maxValueCandidate, targetValue * 1.2 || 1);
                          const scaleMax = maxValue * 1.3;
                          const cursorPercent = Math.min((metric.planned / scaleMax) * 100, 100);
                          const targetPercent = Math.min((targetValue / scaleMax) * 100, 100);
                          const maxPercent = Math.min((maxValue / scaleMax) * 100, 100);
                          const cautionPercent = Math.min(targetPercent * 0.6, targetPercent);
                          return (
                            <div className="relative h-4 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-900">
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: `linear-gradient(to right,
                                    rgba(248,113,113,0.75) 0%,
                                    rgba(248,113,113,0.75) ${cautionPercent}%,
                                    rgba(251,146,60,0.75) ${cautionPercent}%,
                                    rgba(251,146,60,0.75) ${targetPercent}%,
                                    rgba(16,185,129,0.8) ${targetPercent}%,
                                    rgba(16,185,129,0.8) ${maxPercent}%,
                                    rgba(251,146,60,0.75) ${maxPercent}%,
                                    rgba(251,146,60,0.75) 100%)`,
                                }}
                                aria-hidden
                              />
                              <span
                                className="absolute inset-y-0 w-[2px] bg-white shadow-[0_0_0_2px_rgba(15,23,42,0.85)]"
                                style={{ left: `${targetPercent}%` }}
                                aria-label={timelineCopy.targetLabel}
                              />
                              <span
                                className="absolute inset-y-0 w-[3px] bg-emerald-200 shadow-[0_0_0_2px_rgba(15,23,42,0.65)]"
                                style={{ left: `${maxPercent}%` }}
                                aria-label={timelineCopy.waterCapacityLabel}
                              />
                              <span
                                className={`absolute inset-y-[-4px] h-[24px] w-[6px] rounded-full border-2 border-slate-900 ${
                                  cursorPercent > maxPercent ? "bg-amber-300" : cursorPercent >= targetPercent ? "bg-emerald-300" : "bg-rose-300"
                                } shadow-[0_0_0_2px_rgba(15,23,42,0.85)]`}
                                style={{ left: `${cursorPercent}%`, transform: "translateX(-50%)" }}
                              />
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between text-xs text-slate-200">
                          <span className="font-semibold">
                            {timelineCopy.targetLabel}: {metric.format(metric.targetValue)}
                          </span>
                          {metric.helper ? (
                            <span className="text-amber-100">{metric.helper}</span>
                          ) : null}
                        </div>
                      </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                const pointNumber = itemIndex === 0 ? 1 : Math.ceil(itemIndex / 2) + 1;
                const distanceFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.distanceKm` as const)
                    : null;
                const nameFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.name` as const)
                    : null;
                const metaText = `${formatDistanceWithUnit(item.distanceKm)} · ${timelineCopy.etaLabel}: ${formatMinutes(item.etaMinutes)}`;

                const nextSegment = item.upcomingSegment;
                const supplies = item.isStart ? startSupplies : item.checkpointSegment?.supplies;
                const summarized = summarizeSupplies(supplies);
                const supplyMetrics = ["carbs", "water", "sodium"].map((key) => {
                  const metricKey = key as "carbs" | "water" | "sodium";
                  const planned =
                    metricKey === "carbs"
                      ? summarized?.totals.carbs ?? 0
                      : metricKey === "water"
                        ? nextSegment?.plannedWaterMl ?? 0
                        : summarized?.totals.sodium ?? 0;
                  const target =
                    metricKey === "carbs"
                      ? nextSegment?.targetFuelGrams ?? 0
                      : metricKey === "water"
                        ? nextSegment?.targetWaterMl ?? 0
                        : nextSegment?.targetSodiumMg ?? 0;
                  const format =
                    metricKey === "carbs"
                      ? formatFuelAmount
                      : metricKey === "water"
                        ? formatWaterAmount
                        : formatSodiumAmount;
                  const plannedForStatus =
                    metricKey === "water" && target > 0 ? Math.min(planned, target) : planned;
                  const status = getPlanStatus(plannedForStatus, target);
                  return {
                    key: metricKey,
                    label:
                      metricKey === "carbs"
                        ? timelineCopy.gelsBetweenLabel
                        : metricKey === "water"
                          ? copy.sections.summary.items.water
                          : copy.sections.summary.items.sodium,
                    planned,
                    target,
                    format,
                    status,
                  };
                });
                const isCollapsible =
                  !!nextSegment && (item.isStart || (typeof item.aidStationIndex === "number" && !item.isFinish));
                const collapseKey = isCollapsible ? (item.isStart ? "start" : String(item.aidStationIndex)) : null;
                const isCollapsed = isCollapsible && collapseKey ? Boolean(collapsedAidStations[collapseKey]) : false;
                if (isCollapsible && isCollapsed) {
                  hideNextSegment = true;
                }
                const sectionStatus = prioritizeStatus(
                  supplyMetrics.map((metric) => ({ tone: metric.status.tone, label: metric.status.label })),
                  { label: timelineCopy.status.atTarget, tone: "neutral" as const }
                );
                const titleContent = item.title;
                const metaContent = metaText;
                const toggleButton =
                  isCollapsible && collapseKey ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 rounded-full border border-slate-700 bg-slate-900/60 p-0 text-xs font-semibold text-slate-100 hover:bg-slate-800/60"
                      onClick={() => toggleAidStationCollapse(collapseKey)}
                    >
                      <span className="sr-only">
                        {isCollapsed ? timelineCopy.expandLabel : timelineCopy.collapseLabel}
                      </span>
                      {isCollapsed ? (
                        <ChevronDownIcon className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronUpIcon className="h-4 w-4" aria-hidden />
                      )}
                    </Button>
                  ) : null;

                const suppliesDropZone =
                  item.isStart || typeof item.aidStationIndex === "number" ? (
                    <div
                      className="flex w-full flex-col gap-3 rounded-lg border border-dashed border-emerald-400/40 bg-emerald-500/5 p-3 transition hover:border-emerald-300/70"
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-emerald-50">{copy.sections.gels.title}</p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() =>
                          setSupplyPicker({
                            type: item.isStart ? "start" : "aid",
                            index: item.isStart ? undefined : (item.aidStationIndex as number),
                          })
                        }
                      >
                        Add product
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {summarized?.items?.length
                        ? summarized.items.map(({ product, quantity }) => (
                            <div
                              key={product.id}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-slate-950/70 px-3 py-1 text-sm text-slate-50"
                            >
                              <span className="font-semibold">{`${product.name} x${quantity}`}</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="h-6 w-6 rounded-full border border-slate-700 bg-slate-900/80 text-slate-200 hover:text-white"
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
                                  className="h-6 w-6 rounded-full border border-slate-700 bg-slate-900/80 text-slate-200 hover:text-white"
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
                    <p className="text-[11px] text-slate-300">
                      {copy.sections.summary.items.carbs}: {formatFuelAmount(summarized?.totals.carbs ?? 0)} ·{" "}
                      {copy.sections.summary.items.water}: {formatWaterAmount(summarized?.totals.water ?? 0)} ·{" "}
                      {copy.sections.summary.items.sodium}: {formatSodiumAmount(summarized?.totals.sodium ?? 0)}
                    </p>
                  </div>
                ) : null;

                carrySupplies = supplies ?? [];

                const waterRefillFieldName =
                  typeof item.aidStationIndex === "number"
                    ? (`aidStations.${item.aidStationIndex}.waterRefill` as const)
                    : null;

                const distanceInput =
                  distanceFieldName && !isCollapsed && waterRefillFieldName ? (
                    <div className="flex flex-wrap items-end gap-3 text-right sm:text-left">
                      <label className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                          {...register(waterRefillFieldName)}
                        />
                        <span>{aidStationsCopy.labels.waterRefill}</span>
                      </label>
                    </div>
                  ) : null;

                const removeButton =
                  typeof item.aidStationIndex === "number" && !item.isFinish ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 rounded-full border border-red-500/50 bg-red-500/10 px-0 text-lg font-bold text-red-200 hover:bg-red-500/20 hover:text-red-100"
                      onClick={() => onRemoveAidStation(item.aidStationIndex as number)}
                    >
                      <span aria-hidden>×</span>
                      <span className="sr-only">
                        {aidStationsCopy.remove} {item.title}
                      </span>
                    </Button>
                  ) : null;

                if (isCollapsible && isCollapsed) {
                  return (
                    <div key={item.id} className="relative pl-8">
                      <div className="rounded-2xl border border-slate-900/80 bg-slate-950/85 p-4 shadow-[0_4px_30px_rgba(15,23,42,0.45)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/25 text-sm font-semibold text-emerald-100">
                              {pointNumber}
                            </span>
                            <div className="space-y-1">
                              <p className="text-base font-semibold text-slate-50">{item.title}</p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                <span>
                                  {formatDistanceWithUnit(item.distanceKm)} · {timelineCopy.etaLabel}:{" "}
                                  {formatMinutes(item.etaMinutes)}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-800/60 bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-slate-100">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                  {timelineCopy.collapsedScopeLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {removeButton}
                            {toggleButton}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {supplyMetrics.map((metric) => (
                            <span
                              key={metric.key}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusToneStyles[metric.status.tone]}`}
                            >
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-800/60 bg-slate-950/40 text-xs font-bold">
                                {statusToneIcons[metric.status.tone]}
                              </span>
                              <span className="uppercase tracking-wide text-slate-100">{metric.label}</span>
                            </span>
                          ))}
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${statusToneStyles[sectionStatus.tone]}`}
                          >
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-800/60 bg-slate-950/40 text-sm font-bold">
                              {statusToneIcons[sectionStatus.tone]}
                            </span>
                            <span>{sectionStatus.label}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={item.id} className="relative pl-8">
                    <TimelinePointCard
                      pointIndex={pointNumber}
                      title={titleContent}
                      meta={metaContent}
                      metrics={[]}
                      distanceInput={distanceInput}
                      finishLabel={copy.defaults.finish}
                      removeAction={
                        isCollapsible ? (
                          <div className="flex items-center gap-3">
                            {toggleButton}
                            {removeButton}
                          </div>
                        ) : (
                          removeButton
                        )
                      }
                      isStart={item.isStart}
                      isFinish={item.isFinish}
                      dropSection={isCollapsed ? null : suppliesDropZone}
                      onTitleClick={
                        typeof item.aidStationIndex === "number"
                          ? () =>
                              setEditorState({
                                mode: "edit",
                                index: item.aidStationIndex as number,
                                name: item.title,
                                distance: String(item.distanceKm ?? 0),
                              })
                          : undefined
                      }
                    />
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
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-50">
                {editorState.mode === "edit" ? aidStationsCopy.title : aidStationsCopy.add}
              </p>
              <Button variant="ghost" className="h-8 px-2" onClick={closeEditor}>
                ✕
              </Button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300">{aidStationsCopy.labels.name}</Label>
                <Input
                  value={editorState.name}
                  onChange={(event) => updateEditorField("name", event.target.value)}
                  className="border-slate-800/70 bg-slate-900 text-sm font-semibold text-slate-50 focus-visible:ring-emerald-400"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-300">{aidStationsCopy.labels.distance}</Label>
                <Input
                  value={editorState.distance}
                  onChange={(event) => updateEditorField("distance", event.target.value)}
                  type="number"
                  step="0.5"
                  min="0"
                  className="border-slate-800/70 bg-slate-900 text-sm font-semibold text-slate-50 focus-visible:ring-emerald-400"
                />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl space-y-4 rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-50">{copy.sections.gels.title}</p>
                <p className="text-sm text-slate-300">{copy.sections.gels.description}</p>
              </div>
              <Button variant="ghost" className="h-8 px-2" onClick={() => setSupplyPicker(null)}>
                ✕
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
                value={pickerSearch}
                onChange={(event) => setPickerSearch(event.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full max-w-md border-slate-800/70 bg-slate-900 text-sm text-slate-50 focus-visible:ring-emerald-400"
              />
              <p className="text-xs text-slate-300">{`${pickerFavorites.length}/3 favoris sélectionnés`}</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-sm text-slate-200">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    {[
                      { key: "name", label: "Nom" },
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
                  {fuelProducts
                    .filter((product) => {
                      if (!pickerSearch.trim()) return true;
                      const term = pickerSearch.toLowerCase();
                      return product.name.toLowerCase().includes(term) || product.slug.toLowerCase().includes(term);
                    })
                    .sort((a, b) => {
                      const dir = pickerSort.dir === "asc" ? 1 : -1;
                      if (pickerSort.key === "name") return a.name.localeCompare(b.name) * dir;
                      if (pickerSort.key === "carbs") return (a.carbsGrams - b.carbsGrams) * dir;
                      if (pickerSort.key === "sodium") return (a.sodiumMg - b.sodiumMg) * dir;
                      return (a.caloriesKcal - b.caloriesKcal) * dir;
                    })
                    .map((product) => {
                      const isSelected = supplyPickerSelectedSlugs.includes(product.slug);
                      const isFavorite = pickerFavorites.includes(product.slug);
                      return (
                        <tr key={product.slug} className="border-t border-slate-800/80">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className={`text-lg ${isFavorite ? "text-amber-300" : "text-slate-500"} hover:text-amber-200`}
                                onClick={() => toggleFavorite(product.slug)}
                                aria-label="Favori"
                              >
                                ★
                              </button>
                              <span className="font-semibold">{product.name}</span>
                            </div>
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
