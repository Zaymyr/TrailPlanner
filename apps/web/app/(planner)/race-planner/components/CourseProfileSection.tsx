"use client";

import type React from "react";
import type { UseFormRegister } from "react-hook-form";
import { GpxImportIcon, SummitIcon, TrailIcon } from "@pace-yourself/design-system/icons";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { AidStation, ElevationPoint, FormValues, Segment } from "../types";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Button } from "../../../../components/ui/button";
import { ChevronDownIcon, ChevronUpIcon } from "../../../../components/race-planner/TimelineIcons";
import { ElevationProfileChart } from "./ElevationProfileChart";

type CardTitleWithTooltipProps = {
  title: string;
  description: string;
  headingLevel?: "h2" | "h3";
  visuallyHidden?: boolean;
};

const CardTitleWithTooltip = ({
  title,
  description,
  headingLevel = "h2",
  visuallyHidden = false,
}: CardTitleWithTooltipProps) => {
  const HeadingTag = headingLevel;

  if (visuallyHidden) {
    // Embedded in a setup step whose header already shows the same title.
    return (
      <HeadingTag className="sr-only">
        {title}. {description}
      </HeadingTag>
    );
  }

  return (
    <HeadingTag className="flex items-center gap-2 font-[family-name:var(--font-plan-display)] text-lg font-semibold leading-none tracking-[-0.01em] text-[#1F2410]">
      <span>{title}</span>
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#E5E2D8] bg-white text-[11px] font-semibold text-[#5C6450]"
        title={description}
        aria-label={description}
      >
        ?
      </span>
    </HeadingTag>
  );
};

type CourseProfileSectionProps = {
  sectionId: string;
  copy: RacePlannerTranslations;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
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
  headingLevel?: "h2" | "h3";
  showCollapseToggle?: boolean;
};

const fieldLabelClass = "flex items-center gap-1.5 text-[13px] font-medium text-[#5C6450]";
const numberInputClass =
  "h-11 rounded-[10px] border-[#C9C5B8] font-[family-name:var(--font-plan-mono)] text-base font-semibold tabular-nums text-[#1F2410] shadow-none focus-visible:outline-[#2D5016]";
const compactNumberInputClass =
  "!h-9 w-[110px] rounded-[10px] border-[#C9C5B8] font-[family-name:var(--font-plan-mono)] text-sm font-semibold tabular-nums text-[#1F2410] shadow-none focus-visible:outline-[#2D5016]";
const actionButtonClass = "w-full px-3.5 text-[13px] sm:w-auto";

export const CourseProfileSection = ({
  sectionId,
  copy,
  isCollapsed = false,
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
  headingLevel = "h2",
  showCollapseToggle = true,
}: CourseProfileSectionProps) => {
  const isEmbedded = !showCollapseToggle;

  const sourceButtons = (
    <div id="onboarding-course-btns" className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
      <Button variant="outline" type="button" className={actionButtonClass} onClick={() => fileInputRef.current?.click()}>
        <GpxImportIcon size={16} strokeWidth={1.8} />
        {copy.buttons.importGpx}
      </Button>
      <Button variant="outline" type="button" className={actionButtonClass} onClick={onOpenRaceCatalog}>
        <TrailIcon size={16} strokeWidth={1.8} />
        {copy.buttons.chooseRace}
      </Button>
    </div>
  );

  const exportButton = (
    <Button
      type="button"
      className={!allowExport ? `relative ${actionButtonClass} premium-glow` : `relative ${actionButtonClass}`}
      onClick={allowExport ? onExportGpx : onRequestExportUpgrade}
      variant={allowExport ? "default" : "outline"}
    >
      {copy.buttons.exportGpx}
    </Button>
  );

  const importErrorMessage = importError ? (
    <p className="w-full rounded-[10px] border border-[#C0392B]/30 bg-[#FDECEA] px-3 py-2 text-[13px] text-[#C0392B]">
      {importError}
    </p>
  ) : null;

  return (
    <div
      id={sectionId}
      className={
        isEmbedded
          ? "relative"
          : "relative overflow-hidden rounded-2xl border border-[#E5E2D8] bg-[#FAF8F2]"
      }
    >
      <input ref={fileInputRef} type="file" accept=".gpx,application/gpx+xml" className="hidden" onChange={onImportGpx} />
      <div className={isEmbedded ? "" : "px-4 pb-3 pt-4 sm:px-6"}>
        <div className={isEmbedded && !isCollapsed ? "" : "flex flex-wrap items-center justify-between gap-3"}>
          <CardTitleWithTooltip
            title={copy.sections.courseProfile.title}
            description={copy.sections.courseProfile.description}
            headingLevel={headingLevel}
            visuallyHidden={isEmbedded}
          />
          {isCollapsed ? (
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              {sourceButtons}
              {exportButton}
              {importErrorMessage}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="raceDistanceKm" className={fieldLabelClass}>
                    {copy.sections.raceInputs.fields.raceDistance}
                  </Label>
                  <Input
                    id="raceDistanceKm"
                    type="number"
                    step="0.5"
                    className={compactNumberInputClass}
                    {...register("raceDistanceKm", { valueAsNumber: true })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="elevationGain" className={fieldLabelClass}>
                    <SummitIcon size={14} strokeWidth={1.8} color="#3F6B1F" />
                    {copy.sections.raceInputs.fields.elevationGain}
                  </Label>
                  <Input
                    id="elevationGain"
                    type="number"
                    min="0"
                    step="50"
                    className={compactNumberInputClass}
                    {...register("elevationGain", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {isCollapsed ? null : (
        <div className={isEmbedded ? "space-y-5" : `space-y-5 px-4 sm:px-6 ${showCollapseToggle ? "pb-14" : "pb-5"}`}>
          {/* The profile is the strong surface of this step: a clean topo strip. */}
          <div className="min-h-[200px] w-full rounded-[10px] border border-[#E5E2D8] bg-white px-2 pb-2 pt-3 sm:px-4 sm:pt-4">
            <ElevationProfileChart
              profile={elevationProfile}
              aidStations={aidStations}
              segments={segments}
              totalDistanceKm={totalDistanceKm}
              copy={copy}
              baseMinutesPerKm={baseMinutesPerKm}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 font-[family-name:var(--font-plan-display)] text-[14px] font-semibold text-[#1F2410]">
                {copy.sections.raceInputs.courseTitle}
              </legend>
              <div className="grid max-w-md grid-cols-2 gap-3">
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="raceDistanceKm" className={fieldLabelClass}>
                    {copy.sections.raceInputs.fields.raceDistance}
                  </Label>
                  <Input
                    id="raceDistanceKm"
                    type="number"
                    step="0.5"
                    className={numberInputClass}
                    {...register("raceDistanceKm", { valueAsNumber: true })}
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="elevationGain" className={fieldLabelClass}>
                    <SummitIcon size={14} strokeWidth={1.8} color="#3F6B1F" />
                    {copy.sections.raceInputs.fields.elevationGain}
                  </Label>
                  <Input
                    id="elevationGain"
                    type="number"
                    min="0"
                    step="50"
                    className={numberInputClass}
                    {...register("elevationGain", { valueAsNumber: true })}
                  />
                </div>
              </div>
            </fieldset>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
              {sourceButtons}
              {exportButton}
            </div>
          </div>
          {importErrorMessage}
        </div>
      )}

      {showCollapseToggle && onToggleCollapsed ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
          <Button
            type="button"
            variant="ghost"
            className="pointer-events-auto h-10 w-10 rounded-full border border-[#E5E2D8] bg-white text-[#1F2410] shadow-sm hover:bg-[#F4F2EC]"
            aria-label={isCollapsed ? "Expand course profile" : "Collapse course profile"}
            onClick={onToggleCollapsed}
          >
            {isCollapsed ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
