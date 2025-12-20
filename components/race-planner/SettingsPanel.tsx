"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { UseFormRegister } from "react-hook-form";
import type { RacePlannerTranslations } from "../../locales/types";
import type { FormValues } from "../../app/(coach)/race-planner/types";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type SettingsPanelProps = {
  copy: RacePlannerTranslations;
  sectionIds: { inputs: string; pacing: string; intake: string };
  importError: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onExportGpx: () => void;
  register: UseFormRegister<FormValues>;
  paceType: FormValues["paceType"];
  onPaceTypeChange: (nextType: FormValues["paceType"]) => void;
};

type AccordionSectionProps = {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

const VISIBILITY_KEY = "race-planner:settings-visible";

function AccordionSection({ id, title, description, defaultOpen = true, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="overflow-hidden rounded-md border border-slate-800/60 bg-slate-950/60">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-slate-900/60"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-slate-100">{title}</p>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        <span className="text-sm font-semibold text-slate-400">{open ? "–" : "+"}</span>
      </button>
      {open ? <div className="space-y-3 border-t border-slate-800/60 px-3 py-3">{children}</div> : null}
    </div>
  );
}

export function SettingsPanel({
  copy,
  sectionIds,
  importError,
  fileInputRef,
  onExportGpx,
  register,
  paceType,
  onPaceTypeChange,
}: SettingsPanelProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedVisibility = window.localStorage.getItem(VISIBILITY_KEY);
    if (storedVisibility === "hidden") {
      setIsVisible(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VISIBILITY_KEY, isVisible ? "shown" : "hidden");
  }, [isVisible]);

  const paceOptions = useMemo(
    () =>
      [
        { key: "pace", label: copy.sections.raceInputs.paceOptions.pace as string },
        { key: "speed", label: copy.sections.raceInputs.paceOptions.speed as string },
      ] satisfies { key: FormValues["paceType"]; label: string }[],
    [copy.sections.raceInputs.paceOptions.pace, copy.sections.raceInputs.paceOptions.speed]
  );

  return (
    <Card id={sectionIds.inputs} className="border-slate-800/80 bg-slate-950/70 shadow-lg">
      <CardHeader className="space-y-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              {copy.sections.raceInputs.title}
            </p>
            <p className="text-xs text-slate-400">{copy.sections.raceInputs.description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 text-xs"
            aria-pressed={isVisible}
            onClick={() => setIsVisible((prev) => !prev)}
          >
            {isVisible ? copy.sections.raceInputs.hide : copy.sections.raceInputs.show}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            type="button"
            className="h-10 px-3 text-xs font-semibold"
            onClick={() => fileInputRef.current?.click()}
          >
            {copy.buttons.importGpx}
          </Button>
          <Button type="button" className="h-10 px-3 text-xs font-semibold" onClick={onExportGpx}>
            {copy.buttons.exportGpx}
          </Button>
        </div>

        {importError ? <p className="text-xs text-red-400">{importError}</p> : null}
      </CardHeader>

      {isVisible ? (
        <CardContent className="space-y-4">
          <AccordionSection id={`${sectionIds.inputs}-course`} title={copy.sections.raceInputs.courseTitle}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="raceDistanceKm" className="text-xs text-slate-200">
                  {copy.sections.raceInputs.fields.raceDistance}
                </Label>
                <Input
                  id="raceDistanceKm"
                  type="number"
                  step="0.5"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("raceDistanceKm", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elevationGain" className="text-xs text-slate-200">
                  {copy.sections.raceInputs.fields.elevationGain}
                </Label>
                <Input
                  id="elevationGain"
                  type="number"
                  min="0"
                  step="50"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("elevationGain", { valueAsNumber: true })}
                />
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            id={sectionIds.pacing}
            title={copy.sections.raceInputs.pacingTitle}
            description={copy.sections.raceInputs.fields.paceType}
          >
            <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3 rounded-md border border-slate-800/60 bg-slate-900/60 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {paceOptions.map((option) => {
                      const isActive = paceType === option.key;
                      return (
                        <Button
                          key={option.key}
                          type="button"
                          variant={isActive ? "default" : "outline"}
                          className="w-full justify-center text-xs"
                          aria-pressed={isActive}
                          onClick={() => onPaceTypeChange(option.key)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                  <input id="paceType" type="hidden" {...register("paceType")} />

                  {paceType === "pace" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="paceMinutes" className="text-xs text-slate-200">
                          {copy.sections.raceInputs.fields.paceMinutes}
                        </Label>
                        <Input
                          id="paceMinutes"
                          type="number"
                          min="0"
                          step="1"
                          className="border-slate-800/70 bg-slate-950/80 text-sm"
                          {...register("paceMinutes", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paceSeconds" className="text-xs text-slate-200">
                          {copy.sections.raceInputs.fields.paceSeconds}
                        </Label>
                        <Input
                          id="paceSeconds"
                          type="number"
                          min="0"
                          max="59"
                          step="1"
                          className="border-slate-800/70 bg-slate-950/80 text-sm"
                          {...register("paceSeconds", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="speedKph" className="text-xs text-slate-200">
                        {copy.sections.raceInputs.fields.speedKph}
                      </Label>
                      <Input
                        id="speedKph"
                        type="number"
                        min="0"
                        step="0.1"
                        className="border-slate-800/70 bg-slate-950/80 text-sm"
                        {...register("speedKph", { valueAsNumber: true })}
                      />
                    </div>
                  )}
                </div>
              <div className="space-y-3 rounded-md border border-slate-800/60 bg-slate-900/60 p-3">
                <div className="space-y-2">
                  <Label htmlFor="uphillEffort" className="text-xs text-slate-200">
                    {copy.sections.raceInputs.fields.uphillEffort}
                  </Label>
                  <Input
                    id="uphillEffort"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className="accent-emerald-400"
                    {...register("uphillEffort", { valueAsNumber: true })}
                  />
                  <p className="text-[11px] text-slate-500">{copy.sections.raceInputs.fields.uphillEffortHelp}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="downhillEffort" className="text-xs text-slate-200">
                    {copy.sections.raceInputs.fields.downhillEffort}
                  </Label>
                  <Input
                    id="downhillEffort"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    className="accent-emerald-400"
                    {...register("downhillEffort", { valueAsNumber: true })}
                  />
                  <p className="text-[11px] text-slate-500">{copy.sections.raceInputs.fields.downhillEffortHelp}</p>
                </div>
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            id={sectionIds.intake}
            title={copy.sections.raceInputs.nutritionTitle}
            description={copy.sections.raceInputs.description}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="targetIntakePerHour" className="text-xs text-slate-200">
                  {copy.sections.raceInputs.fields.targetIntakePerHour}
                </Label>
                <Input
                  id="targetIntakePerHour"
                  type="number"
                  step="1"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("targetIntakePerHour", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="waterIntakePerHour" className="text-xs text-slate-200">
                  {copy.sections.raceInputs.fields.waterIntakePerHour}
                </Label>
                <Input
                  id="waterIntakePerHour"
                  type="number"
                  step="50"
                  min="0"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("waterIntakePerHour", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sodiumIntakePerHour" className="text-xs text-slate-200">
                  {copy.sections.raceInputs.fields.sodiumIntakePerHour}
                </Label>
                <Input
                  id="sodiumIntakePerHour"
                  type="number"
                  step="50"
                  min="0"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("sodiumIntakePerHour", { valueAsNumber: true })}
                />
              </div>
            </div>
          </AccordionSection>
        </CardContent>
      ) : null}
    </Card>
  );
}
