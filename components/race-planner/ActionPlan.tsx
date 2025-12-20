"use client";

import type { RacePlannerTranslations } from "../../locales/types";
import type { Segment } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { SectionHeader } from "../ui/SectionHeader";

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
  onAddAidStation?: () => void;
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
        <span>{value}</span>
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
  formatDistanceWithUnit,
  formatMinutes,
  formatFuelAmount,
  formatWaterAmount,
  formatSodiumAmount,
  calculatePercentage,
}: ActionPlanProps) {
  const timelineCopy = copy.sections.timeline;

  const renderSegmentLabel = (segment: Segment) =>
    timelineCopy.segmentLabel.replace("{distance}", segment.segmentKm.toFixed(1));

  return (
    <Card id={sectionId}>
      <CardHeader className="space-y-3">
        <SectionHeader
          title={timelineCopy.title}
          description={timelineCopy.description}
          action={
            segments.length > 0 ? (
              <Button type="button" variant="outline" className="hidden sm:inline-flex" onClick={onPrint}>
                {copy.buttons.printPlan}
              </Button>
            ) : null
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
            {segments.map((segment, index) => (
              <div key={`${segment.checkpoint}-${segment.distanceKm}`} className="relative">
                {index < segments.length - 1 ? (
                  <span className="absolute left-5 top-[calc(100%+4px)] h-4 w-px bg-slate-800" aria-hidden />
                ) : null}
                <div className="relative space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-200">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-50">{segment.checkpoint}</p>
                        <p className="text-xs text-slate-400">
                          {formatDistanceWithUnit(segment.distanceKm)} · {timelineCopy.etaLabel}{" "}
                          {formatMinutes(segment.etaMinutes)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-medium text-slate-300">
                      {renderSegmentLabel(segment)} · {formatMinutes(segment.segmentMinutes)}
                    </p>
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
                    <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {copy.sections.timeline.printView.columns.distance}
                      </p>
                      <p className="text-sm font-semibold text-slate-100">{formatDistanceWithUnit(segment.distanceKm)}</p>
                    </div>
                    <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {copy.sections.timeline.printView.columns.segment}
                      </p>
                      <p className="text-sm font-semibold text-slate-100">
                        {renderSegmentLabel(segment)}
                      </p>
                    </div>
                    <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-2">
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

        {onAddAidStation ? (
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 sm:hidden">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-100">{copy.sections.aidStations.title}</p>
              <Button type="button" size="sm" onClick={onAddAidStation}>
                {copy.sections.aidStations.add}
              </Button>
            </div>
            <p className="mt-1 text-xs text-slate-400">{copy.sections.aidStations.description}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
