"use client";

import dynamic from "next/dynamic";

import type { VideoAidStation, VideoRouteBounds, VideoRoutePoint } from "../../../lib/video-generator";
import type { VideoRaceInfo } from "./VideoCompositionOverlay";

const VideoGeneratorMapClient = dynamic(
  () => import("./VideoGeneratorMapClient").then((module) => module.VideoGeneratorMapClient),
  {
    ssr: false,
    loading: () => <div className="h-[calc(100dvh-14rem)] min-h-[26rem] w-full animate-pulse rounded-xl bg-muted" />,
  },
);

export type VideoGeneratorMapProps = {
  aidStations: VideoAidStation[];
  bounds: VideoRouteBounds;
  points: VideoRoutePoint[];
  race: VideoRaceInfo;
  /** Admin session token for the narration routes (script and voice). */
  accessToken: string;
};

/** Renders two grid cells: the phone preview with its transport bar, then the composition panel. */
export function VideoGeneratorMap(props: VideoGeneratorMapProps) {
  return <VideoGeneratorMapClient {...props} />;
}
