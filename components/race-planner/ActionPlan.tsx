"use client";

import type { UseFormRegister } from "react-hook-form";
import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues, Segment, SegmentPlan } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionHeader } from "../ui/SectionHeader";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

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

type NutrientChipProps = {
  label: string;
  value: string;
  percent: number;
  tone: "carbs" | "water" | "sodium";
  helper?: string;
  statusLabel?: string;
  statusTone?: "neutral" | "warning" | "success";
};

const toneClasses: Record<NutrientChipProps["tone"], string> = {
  carbs: "border-purple-500/40 bg-purple-500/10 text-purple-50",
  water: "border-sky-500/40 bg-sky-500/10 text-sky-50",
  sodium: "border-slate-500/50 bg-slate-500/10 text-slate-50",
};

const statusToneClasses: Record<NonNullable<NutrientChipProps["statusTone"]>, string> = {
  neutral: "text-slate-200",
  warning: "text-amber-300",
  success: "text-emerald-200",
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

function NutrientChip({ label, value, percent, tone, helper, statusLabel, statusTone = "neutral" }: NutrientChipProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-full border px-3 py-2 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <div className="flex flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              tone === "carbs" ? "bg-purple-300" : tone === "water" ? "bg-sky-300" : "bg-slate-300"
            }`}
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </div>
        {helper ? <p className="text-[10px] font-normal text-slate-200/80">{helper}</p> : null}
      </div>
      <div className="flex flex-col items-end gap-1 text-slate-50">
        <span
          className={`text-[11px] font-semibold ${statusLabel ? statusToneClasses[statusTone] : "text-slate-200"}`}
        >
          {statusLabel ?? `${percent.toFixed(0)}%`}
        </span>
        <span>{value}</span>
        {statusLabel ? <span className="text-[11px] text-slate-300">{percent.toFixed(0)}%</span> : null}
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
          <div className="space-y-3">
            {segments.map((segment, index) => {
              const segmentRangeLabel = timelineCopy.rangeLabel
                .replace("{from}", segment.from)
                .replace("{to}", segment.checkpoint);
              const distanceHelper = timelineCopy.segmentDistanceBetween.replace(
                "{distance}",
                segment.segmentKm.toFixed(1)
              );
              const timeFieldName = getSegmentFieldName(segment, "segmentMinutesOverride");
              const pickupFieldName = getSegmentFieldName(segment, "pickupGels");
              const plannedFields: {
                key: "gelsPlanned" | "water" | "sodium";
                tone: NutrientChipProps["tone"];
                label: string;
                planned: number;
                target: number;
                format: (value: number) => string;
                inputType: "gels" | "readonly";
              }[] = [
                {
                  key: "gelsPlanned",
                  tone: "carbs",
                  label: timelineCopy.gelsBetweenLabel,
                  planned: segment.plannedFuelGrams,
                  target: segment.targetFuelGrams,
                  format: formatFuelAmount,
                  inputType: "gels",
                },
                {
                  key: "water",
                  tone: "water",
                  label: copy.sections.summary.items.water,
                  planned: segment.plannedWaterMl,
                  target: segment.targetWaterMl,
                  format: formatWaterAmount,
                  inputType: "readonly",
                },
                {
                  key: "sodium",
                  tone: "sodium",
                  label: copy.sections.summary.items.sodium,
                  planned: segment.plannedSodiumMg,
                  target: segment.targetSodiumMg,
                  format: formatSodiumAmount,
                  inputType: "readonly",
                },
              ];

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
                <div key={`${segment.checkpoint}-${segment.distanceKm}`} className="relative">
                  {index < segments.length - 1 ? (
                    <span className="absolute left-5 top-[calc(100%+4px)] h-4 w-px bg-slate-800" aria-hidden />
                  ) : null}
                  <div className="relative space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-200">
                          {index + 1}
                        </span>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-50">{segmentRangeLabel}</p>
                          <p className="text-xs text-slate-400">
                            {formatDistanceWithUnit(segment.startDistanceKm)} → {formatDistanceWithUnit(segment.distanceKm)}
                          </p>
                          <p className="text-xs text-slate-500">{distanceHelper}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          {timelineCopy.segmentTimeLabel}
                        </p>
                        {timeFieldName ? (
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
                        ) : (
                          <p className="text-sm font-semibold text-slate-100">
                            {formatMinutes(segment.segmentMinutes)}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          {timelineCopy.segmentTimeHelp} (≈ {formatMinutes(segment.estimatedSegmentMinutes)})
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            {copy.sections.timeline.printView.columns.distance}
                          </p>
                          {typeof segment.aidStationIndex === "number" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] font-semibold text-red-200 hover:text-red-100"
                              onClick={() =>
                                typeof segment.aidStationIndex === "number"
                                  ? onRemoveAidStation(segment.aidStationIndex)
                                  : undefined
                              }
                            >
                              {aidStationsCopy.remove}
                            </Button>
                          ) : null}
                        </div>
                        {typeof segment.aidStationIndex === "number" ? (
                          <div className="space-y-1.5">
                            <Input
                              id={`aidStations.${segment.aidStationIndex}.distanceKm`}
                              type="number"
                              step="0.5"
                              className="max-w-[160px]"
                              {...register(`aidStations.${segment.aidStationIndex}.distanceKm`, { valueAsNumber: true })}
                            />
                            <p className="text-[11px] text-slate-400">
                              {copy.sections.timeline.distanceWithUnit}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm font-semibold text-slate-100">
                            {formatDistanceWithUnit(segment.distanceKm)}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          {copy.sections.timeline.printView.columns.segment}
                        </p>
                        <p className="text-sm font-semibold text-slate-100">{distanceHelper}</p>
                        <p className="text-xs text-slate-400">
                          {copy.sections.timeline.printView.columns.from}: {segment.from}
                        </p>
                      </div>
                      <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          {copy.sections.timeline.printView.columns.segmentTime}
                        </p>
                        <p className="text-sm font-semibold text-slate-100">{formatMinutes(segment.segmentMinutes)}</p>
                        <p className="text-xs text-slate-400">
                          {timelineCopy.etaLabel}: {formatMinutes(segment.etaMinutes)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      {plannedFields.map((field) => {
                        const status = getPlanStatus(field.planned, field.target);
                        const total =
                          field.key === "gelsPlanned"
                            ? raceTotals?.fuelGrams
                            : field.key === "water"
                              ? raceTotals?.waterMl
                              : raceTotals?.sodiumMg;
                        return (
                          <NutrientChip
                            key={field.key}
                            tone={field.tone}
                            label={field.label}
                            value={field.format(field.planned)}
                            helper={`${timelineCopy.targetLabel}: ${field.format(field.target)}`}
                            percent={calculatePercentage(field.planned, total)}
                            statusLabel={field.inputType === "gels" ? status.label : undefined}
                            statusTone={status.tone}
                          />
                        );
                      })}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[1.4fr_0.9fr]">
                      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            {timelineCopy.betweenStationsTitle}
                          </p>
                          <p className="text-xs text-slate-500">{timelineCopy.betweenStationsHelper}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {plannedFields.map((field) => {
                            const fieldName = field.key === "gelsPlanned" ? getSegmentFieldName(segment, "gelsPlanned") : null;
                            const status = getPlanStatus(field.planned, field.target);
                            const recommendedGels =
                              field.key === "gelsPlanned"
                                ? Math.max(0, Math.round(segment.recommendedGels * 10) / 10)
                                : null;
                            return (
                              <div key={`${segment.checkpoint}-${field.key}`} className="space-y-1.5">
                                <Label className="text-xs text-slate-200">{field.label}</Label>
                        {field.inputType === "gels" && fieldName ? (
                          <Input
                            id={fieldName}
                            type="number"
                            min="0"
                            step="0.5"
                            defaultValue={segment.gelsPlanned ?? ""}
                            placeholder={recommendedGels?.toString() ?? undefined}
                            className="border-slate-800/70 bg-slate-950/80 text-sm"
                            {...register(fieldName, {
                              setValueAs: parseOptionalNumber,
                            })}
                                  />
                                ) : (
                                  <p className="text-sm font-semibold text-slate-100">{field.format(field.planned)}</p>
                                )}
                                <p className={`text-[11px] ${field.inputType === "gels" && status.tone === "warning" ? "text-amber-300" : "text-slate-400"}`}>
                                  {timelineCopy.targetLabel}: {field.format(field.target)}
                                  {field.inputType === "gels" && recommendedGels !== null
                                    ? ` · ${recommendedGels} ${timelineCopy.gelsBetweenLabel.toLowerCase()} (${status.label})`
                                    : ""}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                        <div className="space-y-1">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400">
                            {timelineCopy.pickupTitle}
                          </p>
                          <p className="text-xs text-slate-500">{timelineCopy.pickupHelper}</p>
                        </div>
                        {!segment.isFinish && pickupFieldName ? (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-200" htmlFor={pickupFieldName}>
                              {timelineCopy.pickupGelsLabel}
                            </Label>
                            <Input
                              id={pickupFieldName}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={segment.pickupGels ?? ""}
                              className="border-slate-800/70 bg-slate-950/80 text-sm"
                              {...register(pickupFieldName, {
                                setValueAs: parseOptionalNumber,
                              })}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400">{copy.defaults.finish}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
