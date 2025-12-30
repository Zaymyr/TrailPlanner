"use client";

import { useEffect, useState } from "react";
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
  const [pacingMode, setPacingMode] = useState<"duration" | "pace" | "speed">("duration");
  const [durationInputs, setDurationInputs] = useState<{ hours: string; minutes: string }>({
    hours: durationHours.toString(),
    minutes: durationRemainderMinutes.toString().padStart(2, "0"),
  });

  useEffect(() => {
    if (pacingMode !== "duration") return;
    setDurationInputs({
      hours: durationHours.toString(),
      minutes: durationRemainderMinutes.toString().padStart(2, "0"),
    });
  }, [durationHours, durationRemainderMinutes, pacingMode]);

  const parseDurationInputs = (hoursValue: string, minutesValue: string) => {
    const hours = Number(hoursValue);
    const minutes = Number(minutesValue);
    const safeHours = Number.isFinite(hours) && hours >= 0 ? hours : 0;
    const safeMinutes = Number.isFinite(minutes) && minutes >= 0 ? Math.min(minutes, 59) : 0;
    return safeHours * 60 + safeMinutes;
  };

  return (
    <div className="space-y-4">
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
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Card id={sectionIds.pacing} className="border-slate-800/70 bg-slate-950/80 shadow-inner shadow-emerald-500/5">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{copy.sections.summary.items.duration}</p>
                  {pacing.durationMinutes ? (
                    <p className="text-xs text-emerald-200">{formatDuration(pacing.durationMinutes)}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {copy.sections.raceInputs.fields.paceType}
                  </p>
                  <div className="flex items-center gap-2 rounded-md border border-slate-800/80 bg-slate-900/80 p-1">
                    {(
                      [
                        { key: "duration", label: copy.sections.summary.items.duration },
                        { key: "pace", label: copy.sections.raceInputs.paceOptions.pace as string },
                        { key: "speed", label: copy.sections.raceInputs.paceOptions.speed as string },
                      ] satisfies { key: "duration" | "pace" | "speed"; label: string }[]
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
                  {pacingMode === "duration" ? (
                    <>
                      <div className="w-[110px] space-y-1">
                        <Label
                          htmlFor="durationHours"
                          className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
                        >
                          {copy.units.hourShort}
                        </Label>
                        <Input
                          id="durationHours"
                          type="number"
                          min="0"
                          step="1"
                          value={durationInputs.hours}
                          className="h-11 border-emerald-400/40 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                          onChange={(event) => {
                            const value = event.target.value;
                            setDurationInputs((previous) => {
                              const next = { ...previous, hours: value };
                              onDurationChange(parseDurationInputs(next.hours, next.minutes));
                              return next;
                            });
                          }}
                        />
                      </div>
                      <div className="w-[110px] space-y-1">
                        <Label
                          htmlFor="durationMinutes"
                          className="text-[11px] font-semibold uppercase tracking-wide text-slate-300"
                        >
                          {copy.units.minuteShort}
                        </Label>
                        <Input
                          id="durationMinutes"
                          type="number"
                          min="0"
                          max="59"
                          step="1"
                          value={durationInputs.minutes}
                          className="h-11 border-emerald-400/40 bg-slate-900 text-base font-semibold text-slate-50 focus-visible:ring-emerald-400"
                          onChange={(event) => {
                            const value = event.target.value;
                            setDurationInputs((previous) => {
                              const next = { ...previous, minutes: value };
                              onDurationChange(parseDurationInputs(next.hours, next.minutes));
                              return next;
                            });
                          }}
                        />
                      </div>
                    </>
                  ) : null}

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
        </CardContent>
      </Card>
    </div>
  );
}
