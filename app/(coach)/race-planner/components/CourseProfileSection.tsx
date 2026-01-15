"use client";

import type React from "react";
import type { UseFormRegister } from "react-hook-form";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { AidStation, ElevationPoint, FormValues, Segment } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Button } from "../../../../components/ui/button";
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "../../../../components/race-planner/TimelineIcons";
import { ElevationProfileChart } from "./ElevationProfileChart";

type CardTitleWithTooltipProps = {
  title: string;
  description: string;
};

const CardTitleWithTooltip = ({ title, description }: CardTitleWithTooltipProps) => (
  <CardTitle className="flex items-center gap-2">
    <span>{title}</span>
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      title={description}
      aria-label={description}
    >
      ?
    </span>
  </CardTitle>
);

type CourseProfileSectionProps = {
  sectionId: string;
  copy: RacePlannerTranslations;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImportGpx: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenRaceCatalog: () => void;
  allowExport: boolean;
  onExportGpx: () => void;
  onRequestExportUpgrade: () => void;
  importError: string | null;
  register: UseFormRegister<FormValues>;
  elevationProfile: ElevationPoint[];
  aidStations: AidStation[];
  segments: Segment[];
  totalDistanceKm: number;
  baseMinutesPerKm: number | null;
};

export const CourseProfileSection = ({
  sectionId,
  copy,
  isCollapsed,
  onToggleCollapsed,
  fileInputRef,
  onImportGpx,
  onOpenRaceCatalog,
  allowExport,
  onExportGpx,
  onRequestExportUpgrade,
  importError,
  register,
  elevationProfile,
  aidStations,
  segments,
  totalDistanceKm,
  baseMinutesPerKm,
}: CourseProfileSectionProps) => (
  <Card id={sectionId} className="relative overflow-hidden">
    <CardHeader className="space-y-0 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitleWithTooltip title={copy.sections.courseProfile.title} description={copy.sections.courseProfile.description} />
        {isCollapsed ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".gpx,application/gpx+xml"
              className="hidden"
              onChange={onImportGpx}
            />
            <Button
              variant="outline"
              type="button"
              className="h-9 px-3 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              {copy.buttons.importGpx}
            </Button>
            <Button variant="outline" type="button" className="h-9 px-3 text-xs" onClick={onOpenRaceCatalog}>
              {copy.buttons.chooseRace}
            </Button>
            <Button
              type="button"
              className="relative h-9 px-3 text-xs"
              onClick={allowExport ? onExportGpx : onRequestExportUpgrade}
              variant={allowExport ? "default" : "outline"}
            >
              <span className="flex items-center gap-1.5" title={!allowExport ? "Premium feature" : undefined}>
                {!allowExport ? (
                  <SparklesIcon
                    className="h-3.5 w-3.5 text-muted-foreground dark:text-slate-100/60"
                    strokeWidth={2}
                    aria-hidden
                  />
                ) : null}
                <span>{copy.buttons.exportGpx}</span>
              </span>
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="raceDistanceKm" className="text-[11px] text-muted-foreground dark:text-slate-300">
                  {copy.sections.raceInputs.fields.raceDistance}
                </Label>
                <Input
                  id="raceDistanceKm"
                  type="number"
                  step="0.5"
                  className="h-8 w-[110px] border-border bg-background text-xs text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                  {...register("raceDistanceKm", { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="elevationGain" className="text-[11px] text-muted-foreground dark:text-slate-300">
                  {copy.sections.raceInputs.fields.elevationGain}
                </Label>
                <Input
                  id="elevationGain"
                  type="number"
                  min="0"
                  step="50"
                  className="h-8 w-[110px] border-border bg-background text-xs text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                  {...register("elevationGain", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </CardHeader>
    <CardContent className="px-4 pb-10 sm:px-6">
      {(() => {
        const courseControls = (
          <div className="w-full max-w-xl space-y-4 rounded-lg border border-border bg-card p-4 dark:border-slate-800 dark:bg-slate-950/60 lg:ml-auto">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground dark:text-slate-50">{copy.sections.raceInputs.courseTitle}</p>
              <p className="text-xs text-muted-foreground dark:text-slate-400">
                {copy.sections.raceInputs.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                type="button"
                className="h-9 px-3 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                {copy.buttons.importGpx}
              </Button>
              <Button variant="outline" type="button" className="h-9 px-3 text-xs" onClick={onOpenRaceCatalog}>
                {copy.buttons.chooseRace}
              </Button>
              <Button
                type="button"
                className="relative h-9 px-3 text-xs"
                onClick={allowExport ? onExportGpx : onRequestExportUpgrade}
                variant={allowExport ? "default" : "outline"}
              >
                <span className="flex items-center gap-1.5" title={!allowExport ? "Premium feature" : undefined}>
                  {!allowExport ? (
                    <SparklesIcon
                      className="h-3.5 w-3.5 text-muted-foreground dark:text-slate-100/60"
                      strokeWidth={2}
                      aria-hidden
                    />
                  ) : null}
                  <span>{copy.buttons.exportGpx}</span>
                </span>
              </Button>
            </div>
            {importError ? <p className="text-xs text-red-400">{importError}</p> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="raceDistanceKm" className="text-xs text-muted-foreground dark:text-slate-200">
                  {copy.sections.raceInputs.fields.raceDistance}
                </Label>
                <Input
                  id="raceDistanceKm"
                  type="number"
                  step="0.5"
                  className="border-border bg-background text-sm text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                  {...register("raceDistanceKm", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elevationGain" className="text-xs text-muted-foreground dark:text-slate-200">
                  {copy.sections.raceInputs.fields.elevationGain}
                </Label>
                <Input
                  id="elevationGain"
                  type="number"
                  min="0"
                  step="50"
                  className="border-border bg-background text-sm text-foreground placeholder:text-muted-foreground dark:border-slate-800/70 dark:bg-slate-950/80 dark:text-slate-50"
                  {...register("elevationGain", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
        );

        if (isCollapsed) {
          return null;
        }

        return (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
            <div className="min-h-[240px] w-full rounded-lg border border-border bg-card p-4 dark:border-slate-800/70 dark:bg-slate-950/40">
              <ElevationProfileChart
                profile={elevationProfile}
                aidStations={aidStations}
                segments={segments}
                totalDistanceKm={totalDistanceKm}
                copy={copy}
                baseMinutesPerKm={baseMinutesPerKm}
              />
            </div>

            {courseControls}
          </div>
        );
      })()}
    </CardContent>
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
      <Button
        type="button"
        variant="ghost"
        className="pointer-events-auto h-10 w-10 rounded-full border border-border bg-card text-foreground shadow-md hover:bg-muted dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-100 dark:hover:bg-slate-900/60"
        aria-label={isCollapsed ? "Expand course profile" : "Collapse course profile"}
        onClick={onToggleCollapsed}
      >
        {isCollapsed ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
      </Button>
    </div>
  </Card>
);
