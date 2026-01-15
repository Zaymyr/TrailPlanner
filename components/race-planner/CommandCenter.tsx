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
      <div className="grid gap-3 md:grid-cols-5">
        <Card
          id={sectionIds.pacing}
          className="border-border bg-card shadow-md md:col-span-2 dark:border-slate-800/70 dark:bg-slate-950/80 dark:shadow-inner dark:shadow-emerald-500/5"
        >
          <CardHeader className="space-y-4 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground dark:text-slate-100">
                {copy.sections.raceInputs.pacingTitle}
              </p>
              {pacing.durationMinutes ? (
                <span className="rounded-md border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                  {formatDuration(pacing.durationMinutes)}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-400">
                {copy.sections.raceInputs.fields.paceType}
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-background p-1 dark:border-slate-800/80 dark:bg-slate-900/80">
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
                      className={`min-h-11 rounded px-4 text-xs font-semibold transition ${
                        isActive
                          ? "bg-emerald-100 text-emerald-900 shadow-[0_0_0_1px_rgba(16,185,129,0.2)] dark:bg-emerald-500/20 dark:text-emerald-100 dark:shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
                          : "text-foreground hover:text-foreground dark:text-slate-300 dark:hover:text-emerald-100"
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
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              {pacingMode === "pace" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <div className="w-[120px] space-y-1">
                    <Label
                      htmlFor="paceMinutes"
                      className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
                    >
                      {copy.sections.raceInputs.fields.paceMinutes}
                    </Label>
                    <Input
                      id="paceMinutes"
                      type="number"
                      min="0"
                      step="1"
                      className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
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
                      className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
                    >
                      {copy.sections.raceInputs.fields.paceSeconds}
                    </Label>
                    <Input
                      id="paceSeconds"
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
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
                    className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
                  >
                    {copy.sections.raceInputs.fields.speedKph}
                  </Label>
                  <Input
                    id="speedKph"
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
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

        <Card
          id={sectionIds.intake}
          className="border-border-strong bg-card shadow-md md:col-span-3 dark:bg-slate-950/80 dark:shadow-inner dark:shadow-emerald-500/5"
        >
          <CardHeader className="space-y-2 pb-3">
            <p className="text-sm font-semibold text-foreground dark:text-slate-100">
              {copy.sections.raceInputs.nutritionTitle}
            </p>
            <p className="text-xs text-foreground dark:text-slate-400">{copy.sections.raceInputs.description}</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label
                htmlFor="targetIntakePerHour"
                className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
              >
                {copy.sections.raceInputs.fields.targetIntakePerHour}
              </Label>
              <Input
                id="targetIntakePerHour"
                type="number"
                step="1"
                className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                {...register("targetIntakePerHour", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="waterIntakePerHour"
                className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
              >
                {copy.sections.raceInputs.fields.waterIntakePerHour}
              </Label>
              <Input
                id="waterIntakePerHour"
                type="number"
                step="50"
                min="0"
                className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                {...register("waterIntakePerHour", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="sodiumIntakePerHour"
                className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
              >
                {copy.sections.raceInputs.fields.sodiumIntakePerHour}
              </Label>
              <Input
                id="sodiumIntakePerHour"
                type="number"
                step="50"
                min="0"
                className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                {...register("sodiumIntakePerHour", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="waterBagLiters"
                className="text-sm font-semibold uppercase tracking-wide text-foreground dark:text-slate-300"
              >
                {copy.sections.raceInputs.fields.waterBagLiters}
              </Label>
              <Input
                id="waterBagLiters"
                type="number"
                step="0.1"
                min="0"
                className="h-11 border-border bg-background text-base font-semibold text-foreground focus-visible:ring-ring dark:bg-slate-900 dark:text-slate-50"
                {...register("waterBagLiters", { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
