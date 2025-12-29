"use client";

import type { UseFormRegister } from "react-hook-form";

import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues } from "../../app/(coach)/race-planner/types";
import { SectionHeader } from "../ui/SectionHeader";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type CommandCenterProps = {
  copy: RacePlannerTranslations;
  sectionIds: { pacing: string; intake: string };
  pacing: {
    durationMinutes: number | null;
    paceMinutes: number;
    paceSeconds: number;
    speedKph: number;
  };
  register: UseFormRegister<FormValues>;
  onDurationChange: (minutes: number) => void;
  onPaceChange: (minutes: number, seconds: number) => void;
  onSpeedChange: (speedKph: number) => void;
  formatDuration: (totalMinutes: number) => string;
};

const clampSeconds = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value), 0), 59);
};

export function CommandCenter({
  copy,
  sectionIds,
  pacing,
  register,
  onDurationChange,
  onPaceChange,
  onSpeedChange,
  formatDuration,
}: CommandCenterProps) {
  const durationHours = pacing.durationMinutes ? Math.max(0, Math.floor(pacing.durationMinutes / 60)) : 0;
  const durationRemainderMinutes = pacing.durationMinutes
    ? Math.max(0, Math.round(pacing.durationMinutes - durationHours * 60))
    : 0;

  return (
    <Card className="border-emerald-500/30 bg-slate-950/70 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]">
      <CardHeader className="space-y-4 pb-2">
        <SectionHeader
          title={copy.sections.raceInputs.pacingTitle}
          description={copy.sections.raceInputs.description}
          action={
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              {copy.sections.summary.items.duration}
            </span>
          }
        />
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50 shadow-inner shadow-emerald-500/10">
          <p className="font-semibold text-emerald-100">{copy.sections.summary.description}</p>
          <p className="mt-1 text-emerald-100/80">{copy.sections.raceInputs.description}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          id={sectionIds.pacing}
          className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-950/80 p-4 shadow-inner shadow-emerald-500/5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-100">{copy.sections.summary.items.duration}</p>
            {pacing.durationMinutes ? (
              <p className="text-xs text-emerald-200">{formatDuration(pacing.durationMinutes)}</p>
            ) : null}
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
            <div className="space-y-1">
              <Label htmlFor="durationHours" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {copy.units.hourShort} · {copy.sections.summary.items.duration}
              </Label>
              <Input
                id="durationHours"
                type="number"
                min="0"
                step="1"
                value={durationHours}
                className="h-11 border-emerald-400/40 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                onChange={(event) => {
                  const hours = Number(event.target.value);
                  if (!Number.isFinite(hours) || hours < 0) return;
                  const nextMinutes = hours * 60 + durationRemainderMinutes;
                  onDurationChange(nextMinutes);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="durationMinutes"
                className="text-xs font-semibold uppercase tracking-wide text-slate-300"
              >
                {copy.units.minuteShort}
              </Label>
              <Input
                id="durationMinutes"
                type="number"
                min="0"
                max="59"
                step="1"
                value={durationRemainderMinutes}
                className="h-11 border-emerald-400/40 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  if (!Number.isFinite(minutes) || minutes < 0) return;
                  const safeMinutes = clampSeconds(minutes);
                  const nextMinutes = durationHours * 60 + safeMinutes;
                  onDurationChange(nextMinutes);
                }}
              />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="paceMinutes" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {copy.sections.raceInputs.paceOptions.pace}
              </Label>
              <div className="grid grid-cols-[1fr_1fr] gap-2">
                <Input
                  id="paceMinutes"
                  type="number"
                  min="0"
                  step="1"
                  className="h-11 border-slate-800/70 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                  {...register("paceMinutes", {
                    valueAsNumber: true,
                    onChange: (event) => {
                      const minutes = Number(event.target.value);
                      if (!Number.isFinite(minutes) || minutes < 0) return;
                      onPaceChange(Math.floor(minutes), pacing.paceSeconds);
                    },
                  })}
                />
                <Input
                  id="paceSeconds"
                  type="number"
                  min="0"
                  max="59"
                  step="1"
                  className="h-11 border-slate-800/70 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                  {...register("paceSeconds", {
                    valueAsNumber: true,
                    onChange: (event) => {
                      const seconds = Number(event.target.value);
                      if (!Number.isFinite(seconds) || seconds < 0) return;
                      onPaceChange(pacing.paceMinutes, clampSeconds(seconds));
                    },
                  })}
                />
              </div>
            </div>
            <div className="space-y-1 md:col-span-2 lg:col-span-1">
              <Label htmlFor="speedKph" className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {copy.sections.raceInputs.fields.speedKph}
              </Label>
              <Input
                id="speedKph"
                type="number"
                min="0"
                step="0.1"
                className="h-11 border-slate-800/70 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                {...register("speedKph", {
                  valueAsNumber: true,
                  onChange: (event) => {
                    const speed = Number(event.target.value);
                    if (!Number.isFinite(speed) || speed < 0) return;
                    onSpeedChange(speed);
                  },
                })}
              />
            </div>
            <div className="space-y-1 lg:col-span-1">
              <Label
                htmlFor="targetIntakePerHour"
                className="text-xs font-semibold uppercase tracking-wide text-slate-300"
              >
                {copy.sections.raceInputs.fields.targetIntakePerHour}
              </Label>
              <Input
                id="targetIntakePerHour"
                type="number"
                step="1"
                className="h-11 border-slate-800/70 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                {...register("targetIntakePerHour", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="waterIntakePerHour"
                className="text-xs font-semibold uppercase tracking-wide text-slate-300"
              >
                {copy.sections.raceInputs.fields.waterIntakePerHour}
              </Label>
              <Input
                id="waterIntakePerHour"
                type="number"
                step="50"
                min="0"
                className="h-11 border-slate-800/70 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                {...register("waterIntakePerHour", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="sodiumIntakePerHour"
                className="text-xs font-semibold uppercase tracking-wide text-slate-300"
              >
                {copy.sections.raceInputs.fields.sodiumIntakePerHour}
              </Label>
              <Input
                id="sodiumIntakePerHour"
                type="number"
                step="50"
                min="0"
                className="h-11 border-slate-800/70 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                {...register("sodiumIntakePerHour", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>
        <input type="hidden" {...register("paceType")} />
      </CardContent>
    </Card>
  );
}
