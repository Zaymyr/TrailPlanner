"use client";

import type { RacePlannerTranslations } from "../../../../locales/types";
import type { ElevationPoint } from "../types";
import { ElevationProfileChart } from "./ElevationProfileChart";

type ElevationSectionChartProps = {
  profile: ElevationPoint[];
  totalDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
};

export function ElevationSectionChart({
  profile,
  totalDistanceKm,
  copy,
  baseMinutesPerKm,
}: ElevationSectionChartProps) {
  if (profile.length < 2 || !Number.isFinite(totalDistanceKm) || totalDistanceKm <= 0) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.sections.courseProfile.sectionEmpty}</p>;
  }

  return (
    <ElevationProfileChart
      profile={profile}
      aidStations={[]}
      segments={[]}
      totalDistanceKm={totalDistanceKm}
      copy={copy}
      baseMinutesPerKm={baseMinutesPerKm}
    />
  );
}
