"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
  register: UseFormRegister<FormValues>;
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
  register,
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

  return (
    <Card id={sectionIds.inputs} className="border-slate-800/80 bg-slate-950/70">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-slate-100">{copy.sections.raceInputs.title}</p>
            <p className="text-xs text-slate-500">{copy.sections.raceInputs.description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 text-xs"
            aria-pressed={isVisible}
            onClick={() => setIsVisible((prev) => !prev)}
          >
            {isVisible ? "Hide settings" : "Show settings"}
          </Button>
        </div>

      </CardHeader>

      {isVisible ? (
      <CardContent className="space-y-3">
          <AccordionSection
            id={`${sectionIds.pacing}-settings`}
            title={copy.sections.raceInputs.pacingTitle}
            description={copy.sections.raceInputs.description}
          >
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
          </AccordionSection>
        </CardContent>
      ) : null}
    </Card>
  );
}
