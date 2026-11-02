"use client";

import dynamic from "next/dynamic";

import type { VideoAidStation, VideoRouteBounds, VideoRoutePoint } from "../../../lib/video-generator";

const VideoGeneratorMapClient = dynamic(
  () => import("./VideoGeneratorMapClient").then((module) => module.VideoGeneratorMapClient),
  {
    ssr: false,
    loading: () => <div className="min-h-[34rem] w-full animate-pulse rounded-xl bg-muted" />,
  },
);

export type VideoGeneratorMapProps = {
  aidStations: VideoAidStation[];
  bounds: VideoRouteBounds;
  points: VideoRoutePoint[];
  raceName: string;
};

export function VideoGeneratorMap(props: VideoGeneratorMapProps) {
  return <VideoGeneratorMapClient {...props} />;
}
