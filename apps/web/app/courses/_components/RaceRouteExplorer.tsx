"use client";

import { useState } from "react";

import { GpxRouteMap, type GpxRouteAidStation, type GpxRouteMapPoint } from "../../../components/gpx/GpxRouteMap";

export function RaceRouteExplorer({
  points,
  aidStations,
  heightClassName,
}: {
  points: GpxRouteMapPoint[];
  aidStations: GpxRouteAidStation[];
  heightClassName?: string;
}) {
  const [interactive, setInteractive] = useState(false);

  return (
    <div className="relative">
      <GpxRouteMap points={points} aidStations={aidStations} heightClassName={heightClassName} interactive={interactive} />
      {!interactive ? (
        <button
          type="button"
          onClick={() => setInteractive(true)}
          className="absolute inset-0 flex items-center justify-center rounded-md bg-foreground/5 transition hover:bg-foreground/10"
        >
          <span className="inline-flex min-h-11 items-center justify-center rounded-md bg-card px-4 text-sm font-semibold text-foreground shadow-sm">
            Explorer la carte
          </span>
        </button>
      ) : null}
    </div>
  );
}
