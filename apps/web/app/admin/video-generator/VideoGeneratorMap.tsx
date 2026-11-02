"use client";

import dynamic from "next/dynamic";

import type { VideoAidStation, VideoRouteBounds, VideoRoutePoint } from "../../../lib/video-generator";

const VideoGeneratorMapClient = dynamic(
  () => import("./VideoGeneratorMapClient").then((module) => module.VideoGeneratorMapClient),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[34rem] w-full animate-pulse bg-muted" />,
  },
);

export type VideoGeneratorMapProps = {
  aidStations: VideoAidStation[];
  bounds: VideoRouteBounds;
  points: VideoRoutePoint[];
};

export function VideoGeneratorMap(props: VideoGeneratorMapProps) {
  return <VideoGeneratorMapClient {...props} />;
}
