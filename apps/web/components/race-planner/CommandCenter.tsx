"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormRegister } from "react-hook-form";

import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues } from "../../app/(planner)/race-planner/types";
import { estimateEffortDurationMinutes } from "../../app/(planner)/race-planner/utils/pacing";
import { withMonoNumbers } from "../../app/(planner)/race-planner/components/PlannerSetupSteps";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type CommandCenterProps = {
  copy: RacePlannerTranslations;
  sectionIds: { pacing: string; intake: string };
  sections?: Array<"pacing" | "intake">;
  headingLevel?: "h2" | "h3";
  pacing: {
    durationMinutes: number | null;
    paceType: "pace" | "speed";
    paceMinutes: number;
    paceSeconds: number;
    speedKph: number;
    fatigueLevel: number;
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

const formatPace = (minutesPerKm: number) => {
  const safeMinutes = Number.isFinite(minutesPerKm) ? Math.max(0, minutesPerKm) : 0;
  const wholeMinutes = Math.floor(safeMinutes);
  let seconds = Math.round((safeMinutes - wholeMinutes) * 60);
  const adjustedMinutes = seconds === 60 ? wholeMinutes + 1 : wholeMinutes;
  seconds = seconds === 60 ? 0 : seconds;

  return `${adjustedMinutes}:${String(seconds).padStart(2, "0")}/km`;
};

// Shared field language of the plan settings: sentence-case labels, mono figures.
const fieldLabelClass = "text-[13px] font-medium leading-snug text-[#5C6450]";
const numberInputClass =
  "h-12 rounded-[10px] border-[#C9C5B8] font-[family-name:var(--font-plan-mono)] text-lg font-semibold tabular-nums text-[#1F2410] shadow-none focus-visible:outline-[#2D5016]";
const quietSurfaceClass = "rounded-2xl border border-[#E5E2D8] bg-white";

export function CommandCenter({
  copy,
  sectionIds,
  sections = ["pacing", "intake"],
  headingLevel = "h2",
  pacing,
  register,
  onPaceChange,
  onSpeedChange,
  formatDuration,
}: CommandCenterProps) {
  const [pacingMode, setPacingMode] = useState<"pace" | "speed">(pacing.paceType);
  const showPacing = sections.includes("pacing");
  const showIntake = sections.includes("intake");
  const showBothSections = showPacing && showIntake;
  // Embedded in a setup step: the step header already carries the title.
  const headingClass = showBothSections
    ? "font-[family-name:var(--font-plan-display)] text-[15px] font-semibold text-[#1F2410]"
    : "sr-only";
  const sectionSurfaceClass = showBothSections ? `${quietSurfaceClass} p-4 sm:p-5` : "";
  const HeadingTag = headingLevel;
  const basePaceMinutesPerKm = useMemo(() => {
    if (pacingMode === "speed") {
      return pacing.speedKph > 0 ? 60 / pacing.speedKph : null;
    }

    const pace = pacing.paceMinutes + pacing.paceSeconds / 60;
    return pace > 0 ? pace : null;
  }, [pacing.paceMinutes, pacing.paceSeconds, pacing.speedKph, pacingMode]);
  const fatigueImpact = useMemo(() => {
    if (!basePaceMinutesPerKm || !pacing.durationMinutes) return null;

    const finalPaceMinutesPerKm = estimateEffortDurationMinutes(basePaceMinutesPerKm, {
      distKm: 1,
      dPlus: 0,
      dMinus: 0,
      elapsedBeforeSeconds: pacing.durationMinutes * 60,
      fatigueLevel: pacing.fatigueLevel,
    });

    return copy.sections.raceInputs.fields.fatigueImpact
      .replace("{basePace}", formatPace(basePaceMinutesPerKm))
      .replace("{finalPace}", formatPace(finalPaceMinutesPerKm))
      .replace("{duration}", formatDuration(pacing.durationMinutes));
  }, [
    basePaceMinutesPerKm,
    copy.sections.raceInputs.fields.fatigueImpact,
    formatDuration,
    pacing.durationMinutes,
    pacing.fatigueLevel,
  ]);
  const fatigueLabel =
    pacing.fatigueLevel <= 0.33
      ? copy.sections.raceInputs.fields.fatigueLow
      : pacing.fatigueLevel >= 0.67
        ? copy.sections.raceInputs.fields.fatigueHigh
        : copy.sections.raceInputs.fields.fatigueMedium;

  useEffect(() => {
    setPacingMode(pacing.paceType);
  }, [pacing.paceType]);

  return (
    <div className="space-y-4">
      <div
        id={showPacing ? "pacing-nutrition-section" : undefined}
        className={showBothSections ? "grid gap-3 md:grid-cols-5" : "grid gap-3"}
      >
        {showPacing ? (
          <div id={sectionIds.pacing} className={`${sectionSurfaceClass} space-y-5 ${showBothSections ? "md:col-span-2" : ""}`}>
            <HeadingTag className={headingClass}>{copy.sections.raceInputs.pacingTitle}</HeadingTag>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1.5">
                <p className={fieldLabelClass}>{copy.sections.raceInputs.fields.paceType}</p>
                <div
                  role="group"
                  aria-label={copy.sections.raceInputs.fields.paceType}
                  className="inline-flex max-w-full rounded-full border border-[#E5E2D8] bg-[#F4F2EC] p-0.5"
                >
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
                        aria-pressed={isActive}
                        className={`min-h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5016] ${
                          isActive
                            ? "bg-[#2D5016] text-[#FAF8F2] shadow-sm"
                            : "text-[#5C6450] hover:text-[#1F2410]"
                        }`}
                        onClick={() => setPacingMode(option.key)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {pacing.durationMinutes ? (
                <span className="inline-flex items-center rounded-full border border-[#B5CC9A] bg-[#E8F0E0] px-3 py-1 font-[family-name:var(--font-plan-mono)] text-[13px] font-semibold tabular-nums text-[#2D5016]">
                  {formatDuration(pacing.durationMinutes)}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-end gap-3">
              {pacingMode === "pace" ? (
                <div className="grid w-full max-w-[280px] grid-cols-[1fr_auto_1fr] items-end gap-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="paceMinutes" className={fieldLabelClass}>
                      {copy.sections.raceInputs.fields.paceMinutes}
                    </Label>
                    <Input
                      id="paceMinutes"
                      type="number"
                      min="0"
                      step="1"
                      className={numberInputClass}
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
                  <span
                    aria-hidden="true"
                    className="pb-3 font-[family-name:var(--font-plan-mono)] text-lg font-semibold text-[#8A917E]"
                  >
                    :
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="paceSeconds" className={fieldLabelClass}>
                      {copy.sections.raceInputs.fields.paceSeconds}
                    </Label>
                    <Input
                      id="paceSeconds"
                      type="number"
                      min="0"
                      max="59"
                      step="1"
                      className={numberInputClass}
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
                <div className="w-full max-w-[160px] space-y-1.5">
                  <Label htmlFor="speedKph" className={fieldLabelClass}>
                    {copy.sections.raceInputs.fields.speedKph}
                  </Label>
                  <Input
                    id="speedKph"
                    type="number"
                    min="0"
                    step="0.1"
                    className={numberInputClass}
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

            <div className="space-y-2.5 border-t border-[#E5E2D8] pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="fatigueLevel" className="text-[14px] font-semibold text-[#1F2410]">
                  {copy.sections.raceInputs.fields.fatigueLevel}
                </Label>
                <span className="text-[13px] font-semibold text-[#2D5016]">{fatigueLabel}</span>
              </div>
              <input
                id="fatigueLevel"
                type="range"
                aria-valuetext={fatigueLabel}
                min="0"
                max="1"
                step="0.01"
                className="block h-6 w-full cursor-pointer accent-[#2D5016] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2D5016]"
                {...register("fatigueLevel", { valueAsNumber: true })}
              />
              <div className="flex items-center justify-between gap-3 text-[12px] text-[#8A917E]">
                <span>{copy.sections.raceInputs.fields.fatigueLow}</span>
                <span>{copy.sections.raceInputs.fields.fatigueMedium}</span>
                <span>{copy.sections.raceInputs.fields.fatigueHigh}</span>
              </div>
              <p className="text-[13px] leading-5 text-[#5C6450]">{copy.sections.raceInputs.fields.fatigueHelper}</p>
              {fatigueImpact ? (
                <p className="rounded-[10px] border-l-2 border-[#2D5016] bg-[#E8F0E0]/70 px-3 py-2 text-[13px] leading-5 text-[#1F2410]">
                  {withMonoNumbers(fatigueImpact)}
                </p>
              ) : null}
            </div>
            <input type="hidden" {...register("paceType")} />
          </div>
        ) : null}

        {showIntake ? (
          <div id={sectionIds.intake} className={`${sectionSurfaceClass} space-y-4 ${showBothSections ? "md:col-span-3" : ""}`}>
            <div className="space-y-1">
              <HeadingTag className={headingClass}>{copy.sections.raceInputs.nutritionTitle}</HeadingTag>
              <p className="text-[13px] leading-5 text-[#5C6450]">{copy.sections.raceInputs.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(
                [
                  { id: "targetIntakePerHour", label: copy.sections.raceInputs.fields.targetIntakePerHour, step: "1" },
                  { id: "waterIntakePerHour", label: copy.sections.raceInputs.fields.waterIntakePerHour, step: "50", min: "0" },
                  { id: "sodiumIntakePerHour", label: copy.sections.raceInputs.fields.sodiumIntakePerHour, step: "50", min: "0" },
                  { id: "waterBagLiters", label: copy.sections.raceInputs.fields.waterBagLiters, step: "0.1", min: "0" },
                ] satisfies {
                  id: "targetIntakePerHour" | "waterIntakePerHour" | "sodiumIntakePerHour" | "waterBagLiters";
                  label: string;
                  step: string;
                  min?: string;
                }[]
              ).map((field) => (
                <div key={field.id} className="flex min-w-0 flex-col justify-end gap-1.5">
                  <Label htmlFor={field.id} className={fieldLabelClass}>
                    {field.label}
                  </Label>
                  <Input
                    id={field.id}
                    type="number"
                    step={field.step}
                    min={"min" in field ? field.min : undefined}
                    className={numberInputClass}
                    {...register(field.id, { valueAsNumber: true })}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
