"use client";

import { useState } from "react";
import type { FieldArrayWithId, UseFormRegister } from "react-hook-form";
import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues, Segment } from "../../app/(coach)/race-planner/types";
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
  aidStationFields: FieldArrayWithId<FormValues, "aidStations", "id">[];
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
};

const toneClasses: Record<NutrientChipProps["tone"], string> = {
  carbs: "border-purple-500/40 bg-purple-500/10 text-purple-50",
  water: "border-sky-500/40 bg-sky-500/10 text-sky-50",
  sodium: "border-slate-500/50 bg-slate-500/10 text-slate-50",
};

function NutrientChip({ label, value, percent, tone }: NutrientChipProps) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            tone === "carbs" ? "bg-purple-300" : tone === "water" ? "bg-sky-300" : "bg-slate-300"
          }`}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-50">
        <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-semibold">{value}</span>
        <span className="text-[11px] text-slate-200">{percent.toFixed(0)}%</span>
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
  aidStationFields,
  register,
  formatDistanceWithUnit,
  formatMinutes,
  formatFuelAmount,
  formatWaterAmount,
  formatSodiumAmount,
  calculatePercentage,
}: ActionPlanProps) {
  const [showAidStations, setShowAidStations] = useState(false);
  const timelineCopy = copy.sections.timeline;
  const aidStationsCopy = copy.sections.aidStations;

  const renderSegmentLabel = (segment: Segment) =>
    timelineCopy.segmentLabel.replace("{distance}", segment.segmentKm.toFixed(1));

  return (
    <Card id={sectionId}>
      <CardHeader className="space-y-3">
        <SectionHeader
          title={timelineCopy.title}
          description={timelineCopy.description}
          action={
            <div className="flex items-center gap-2">
              <Button type="button" onClick={onAddAidStation} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
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
          <div className="space-y-4">
            {segments.map((segment, index) => (
              <div key={`${segment.checkpoint}-${segment.distanceKm}`} className="relative">
                {index < segments.length - 1 ? (
                  <span className="absolute left-5 top-[calc(100%+6px)] h-5 w-px bg-slate-800" aria-hidden />
                ) : null}
                <div className="relative space-y-4 rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-500/30">
                        {index + 1}
                      </span>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-50">{segment.checkpoint}</p>
                        <p className="text-xs text-slate-400">
                          {timelineCopy.etaLabel} {formatMinutes(segment.etaMinutes)} ·{" "}
                          {formatDistanceWithUnit(segment.distanceKm)}
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/60 bg-slate-950/60 px-3 py-1 text-xs font-semibold text-slate-100">
                      <span>{renderSegmentLabel(segment)}</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-100">
                        {formatMinutes(segment.segmentMinutes)}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <NutrientChip
                      tone="carbs"
                      label={copy.sections.summary.items.carbs}
                      value={formatFuelAmount(segment.fuelGrams)}
                      percent={calculatePercentage(segment.fuelGrams, raceTotals?.fuelGrams)}
                    />
                    <NutrientChip
                      tone="water"
                      label={copy.sections.summary.items.water}
                      value={formatWaterAmount(segment.waterMl)}
                      percent={calculatePercentage(segment.waterMl, raceTotals?.waterMl)}
                    />
                    <NutrientChip
                      tone="sodium"
                      label={copy.sections.summary.items.sodium}
                      value={formatSodiumAmount(segment.sodiumMg)}
                      percent={calculatePercentage(segment.sodiumMg, raceTotals?.sodiumMg)}
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {copy.sections.timeline.printView.columns.distance}
                      </p>
                      <p className="text-sm font-semibold text-slate-100">
                        {formatDistanceWithUnit(segment.distanceKm)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {copy.sections.timeline.printView.columns.eta}
                      </p>
                      <p className="text-sm font-semibold text-slate-100">{formatMinutes(segment.etaMinutes)}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800/70 bg-slate-950/70 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {copy.sections.timeline.printView.columns.segmentTime}
                      </p>
                      <p className="text-sm font-semibold text-slate-100">{formatMinutes(segment.segmentMinutes)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <details
          className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/70"
          open={showAidStations}
          onToggle={(event) => setShowAidStations(event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">{aidStationsCopy.title}</p>
              <p className="text-xs text-slate-400">{aidStationsCopy.description}</p>
            </div>
            <span className="text-xs font-semibold text-slate-300">
              {showAidStations ? "–" : "+"}
            </span>
          </summary>
          <div className="space-y-3 border-t border-slate-800 bg-slate-950/60 p-4">
            {aidStationFields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[1.1fr,0.9fr,auto] items-end gap-3 rounded-md border border-slate-800 bg-slate-900/50 p-3"
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`aidStations.${index}.name`}>{aidStationsCopy.labels.name}</Label>
                  <Input id={`aidStations.${index}.name`} type="text" {...register(`aidStations.${index}.name`)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`aidStations.${index}.distanceKm`}>{aidStationsCopy.labels.distance}</Label>
                  <Input
                    id={`aidStations.${index}.distanceKm`}
                    type="number"
                    step="0.5"
                    className="max-w-[140px]"
                    {...register(`aidStations.${index}.distanceKm`, { valueAsNumber: true })}
                  />
                </div>
                <Button type="button" variant="ghost" onClick={() => onRemoveAidStation(index)}>
                  {aidStationsCopy.remove}
                </Button>
              </div>
            ))}
            <Button type="button" className="w-full" onClick={onAddAidStation}>
              {aidStationsCopy.add}
            </Button>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
