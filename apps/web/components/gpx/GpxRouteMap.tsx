"use client";

import dynamic from "next/dynamic";

const GpxRouteMapClient = dynamic(() => import("./GpxRouteMapClient").then((module) => module.GpxRouteMapClient), {
  ssr: false,
  loading: () => <div className="h-full min-h-[220px] w-full animate-pulse rounded-md bg-muted" />,
});

export type GpxRouteMapPoint = {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lon: number;
};

export type GpxRouteAidStation = {
  name: string;
  distanceKm: number;
};

export type GpxRouteMapProps = {
  aidStations?: GpxRouteAidStation[];
  className?: string;
  heightClassName?: string;
  interactive?: boolean;
  points: GpxRouteMapPoint[];
};

export function GpxRouteMap(props: GpxRouteMapProps) {
  return <GpxRouteMapClient {...props} />;
}
