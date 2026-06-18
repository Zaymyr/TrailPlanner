"use client";

import type { RacePlannerTranslations } from "../../../../locales/types";
import type { ElevationPoint } from "../types";
import { getElevationSliceXY } from "../utils/elevation-slice";
import { ElevationProfileChart } from "./ElevationProfileChart";

type SubSectionElevationChartProps = {
  elevationProfile: ElevationPoint[];
  startDistanceKm: number;
  endDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
};

export function SubSectionElevationChart({
  elevationProfile,
  startDistanceKm,
  endDistanceKm,
  copy,
  baseMinutesPerKm,
}: SubSectionElevationChartProps) {
  const { x, y } = getElevationSliceXY(elevationProfile, startDistanceKm, endDistanceKm);
  const totalDistanceKm = Math.max(0, Math.abs(endDistanceKm - startDistanceKm));

  if (x.length < 2 || totalDistanceKm <= 0) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.sections.courseProfile.sectionEmpty}</p>;
  }

  const profile = x.map((distanceKm, index) => ({
    distanceKm,
    elevationM: y[index] ?? 0,
  }));

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
