"use client";

import { useState } from "react";
import type { UseFormRegister } from "react-hook-form";

import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues } from "../../app/(coach)/race-planner/types";
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
  onPaceChange,
  onSpeedChange,
  formatDuration,
}: CommandCenterProps) {
  const [pacingMode, setPacingMode] = useState<"pace" | "speed">("pace");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Card id={sectionIds.pacing} className="border-slate-800/70 bg-slate-950/80 shadow-inner shadow-emerald-500/5">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">{copy.sections.raceInputs.pacingTitle}</p>
              {pacing.durationMinutes ? (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {formatDuration(pacing.durationMinutes)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {copy.sections.raceInputs.fields.paceType}
              </p>
              <div className="flex items-center gap-2 rounded-md border border-slate-800/80 bg-slate-900/80 p-1">
                {(
                  [
                    { key: "pace", label: copy.sections.raceInputs.paceOptions.pace as string },
                    { key: "speed", label: copy.sections.raceInputs.paceOptions.speed as string },
                  ] satisfies { key: "pace" | "speed"; label: string }[]
                ).map((option) => {
                  const isActive = pacingMode === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`rounded px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "bg-emerald-500/20 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                          : "text-slate-300 hover:text-emerald-100"
                      }`}
                      onClick={() => setPacingMode(option.key)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              {pacingMode === "pace" ? (
                <div className="flex flex-wrap gap-2">
                  <div className="w-[120px] space-y-1">
                    <Label
                      htmlFor="paceMinutes"
                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
                    >
                      {copy.sections.raceInputs.fields.paceMinutes}
                    </Label>
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
                  </div>
                  <div className="w-[120px] space-y-1">
                    <Label
                      htmlFor="paceSeconds"
                      className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
                    >
                      {copy.sections.raceInputs.fields.paceSeconds}
                    </Label>
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
              ) : null}

              {pacingMode === "speed" ? (
                <div className="w-[140px] space-y-1">
                  <Label
                    htmlFor="speedKph"
                    className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
                  >
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
              ) : null}
            </div>
            <input type="hidden" {...register("paceType")} />
          </CardContent>
        </Card>

        <Card id={sectionIds.intake} className="border-slate-800/70 bg-slate-950/80 shadow-inner shadow-emerald-500/5">
          <CardHeader className="pb-3">
            <p className="text-sm font-semibold text-slate-100">{copy.sections.raceInputs.nutritionTitle}</p>
            <p className="text-xs text-slate-400">{copy.sections.raceInputs.description}</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label
                htmlFor="targetIntakePerHour"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
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
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
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
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
